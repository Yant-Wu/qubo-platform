# worker.py — 後台任務執行器（單一職責：任務狀態流轉與真實運算）
from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import Job, JobHistory, SessionLocal
from schemas import HistoryPoint
from qubo import build_qubo_matrix, aeqts_solver
from qubo.solver import cuda_knapsack_solver, is_cuda_available

_PROBLEM_TYPE_MAP: Dict[str, str] = {
    "knapsack": "knapsack", "Knapsack": "knapsack",
    "maxcut": "max_cut", "MaxCut": "max_cut", "max_cut": "max_cut",
    "custom": "custom",
}

# 0.01π～0.10π 依序掃描；100 次實驗時每個 theta 各執行 10 次。
_THETA_SCALES = tuple(round(index / 100, 2) for index in range(1, 11))


def _theta_schedule(experiment_count: int) -> List[float]:
    return [_THETA_SCALES[index % len(_THETA_SCALES)] for index in range(experiment_count)]


def _is_better_experiment(candidate: Dict[str, Any], incumbent: Optional[Dict[str, Any]]) -> bool:
    """合法解優先；同為合法（或同為不合法）時依價值、收斂速度、能量排序。"""
    if incumbent is None:
        return True
    if candidate["is_feasible"] != incumbent["is_feasible"]:
        return candidate["is_feasible"]
    if candidate["objective"] != incumbent["objective"]:
        return candidate["objective"] > incumbent["objective"]
    if candidate["convergence_iteration"] != incumbent["convergence_iteration"]:
        return candidate["convergence_iteration"] < incumbent["convergence_iteration"]
    return candidate["energy"] < incumbent["energy"]

def process_pending_jobs():
    db = SessionLocal()
    try:
        pending_jobs = db.query(Job).filter(Job.status == "pending").all()
        for job in pending_jobs:
            job.status = "running"
            db.commit()
            print(f"[worker] Job {job.id} → running")
            try:
                _simulate_job(db, job)
                job.status = "completed"
                db.commit()
                print(f"[worker] Job {job.id} → completed")
            except Exception as e:
                job.status = "failed"
                job.error_message = type(e).__name__
                db.commit()
                print(f"[worker] Job {job.id} → failed: {type(e).__name__}")
    finally:
        db.close()

def _make_feasibility_checker(qubo_type: str, raw: Dict[str, Any]):
    if qubo_type == "knapsack":
        items = raw.get("items", [])
        max_weight = float(raw.get("max_weight", float("inf")))
        weights = [float(it["weight"]) for it in items]
        def check_knapsack(x) -> bool:
            return float(sum(w * int(xi) for w, xi in zip(weights, x))) <= max_weight
        return check_knapsack
    if qubo_type == "max_cut": return lambda x: True
    return None

def _make_objective_fn(qubo_type: str, raw: Dict[str, Any]):
    if qubo_type == "knapsack":
        items = raw.get("items", [])
        values = [float(it["value"]) for it in items]
        def knapsack_objective(x) -> float:
            return float(sum(v * int(xi) for v, xi in zip(values, x)))
        return knapsack_objective
    return None

def _simulate_job(db: Session, job: Job):
    qubo_type = _PROBLEM_TYPE_MAP.get(job.problem_type)
    if qubo_type is None:
        raise ValueError(f"problem_type '{job.problem_type}' 目前不支援真實計算")

    raw: Dict[str, Any] = dict(job.problem_data) if job.problem_data else {}
    user_num_iterations = raw.get("num_iterations")
    user_timeout        = raw.get("timeout_seconds")

    if qubo_type == "knapsack" and "max_weight" not in raw and "capacity" in raw:
        raw["max_weight"] = raw["capacity"]

    Q = feasibility_checker = objective_fn = None
    if not (qubo_type == "knapsack" and is_cuda_available()):
        Q = build_qubo_matrix(problem_type=qubo_type, problem_data=raw)
        feasibility_checker = _make_feasibility_checker(qubo_type, raw)
        objective_fn = _make_objective_fn(qubo_type, raw)

    n_vars = Q.shape[0] if Q is not None else len(raw.get("items", []))
    N = int(job.core_limit or 50)
    num_iterations = int(user_num_iterations) if user_num_iterations else 1000
    timeout_secs = float(user_timeout) if user_timeout else 30.0

    import time as _time
    requested_experiment_count = raw.get("experiment_count")
    experiment_count = int(requested_experiment_count) if requested_experiment_count is not None else 100
    if not 1 <= experiment_count <= 100:
        raise ValueError("experiment_count 必須介於 1 到 100")

    run_start = _time.time()
    best_experiment: Optional[Dict[str, Any]] = None

    use_cuda = qubo_type == "knapsack" and is_cuda_available()
    for experiment_index, theta_scale in enumerate(_theta_schedule(experiment_count), start=1):
        if use_cuda:
            items = raw.get("items", [])
            solver_gen = cuda_knapsack_solver(
                weights=[float(item["weight"]) for item in items],
                values=[float(item["value"]) for item in items],
                capacity=float(raw.get("max_weight") or raw.get("capacity", 0)),
                penalty=float(raw.get("penalty", 10.0)),
                slack_bits=raw.get("slack_bits"), N=N, num_iterations=num_iterations,
                seed=None, timeout=timeout_secs, theta_scale=theta_scale,
            )
        else:
            solver_gen = aeqts_solver(
                Q=Q, num_iterations=num_iterations, N=N, seed=None,
                feasibility_checker=feasibility_checker, objective_fn=objective_fn,
                theta_scale=theta_scale,
            )

        run_history: List[Dict[str, Any]] = []
        run_result: Optional[Dict[str, Any]] = None
        run_dashboard_objective = 0.0 if qubo_type == "knapsack" else float("-inf")
        run_dashboard_energy = float("inf")

        for data in solver_gen:
            if data.get("type") == "progress":
                objective = float(data["objective"])
                is_feasible = data.get("is_feasible")
                if qubo_type == "knapsack":
                    if is_feasible is True:
                        run_dashboard_objective = max(run_dashboard_objective, objective)
                else:
                    run_dashboard_objective = max(run_dashboard_objective, objective)

                energy = data.get("energy", data.get("current_energy"))
                if energy is not None:
                    run_dashboard_energy = min(run_dashboard_energy, float(energy))

                run_history.append({
                    "iteration": data["iteration"],
                    "value": round(run_dashboard_objective, 6),
                    "qubo_energy": round(run_dashboard_energy, 6) if run_dashboard_energy < float("inf") else None,
                    "entropy": round(data.get("entropy"), 6) if data.get("entropy") is not None else None,
                    "is_feasible": is_feasible,
                    "qubit_probs": data.get("qubit_probs"),
                })
            elif data.get("type") == "final":
                run_result = data

        if not run_result:
            raise RuntimeError(f"第 {experiment_index} 次實驗未回傳最終結果")

        if qubo_type == "knapsack":
            items = raw.get("items", [])
            solution = run_result.get("solution", [])
            total_weight = sum(float(item["weight"]) for item, bit in zip(items, solution) if bit)
            objective = sum(float(item["value"]) for item, bit in zip(items, solution) if bit)
            is_feasible = total_weight <= float(raw.get("max_weight") or raw.get("capacity", 0))
        else:
            objective = run_history[-1]["value"] if run_history else float("-inf")
            is_feasible = True

        convergence_iteration = next(
            (point["iteration"] for point in run_history if point["value"] >= objective),
            num_iterations,
        )
        candidate = {
            "index": experiment_index,
            "theta": theta_scale,
            "result": run_result,
            "history": run_history,
            "objective": float(objective),
            "is_feasible": bool(is_feasible),
            "convergence_iteration": convergence_iteration,
            "energy": float(run_result["energy"]),
        }
        if _is_better_experiment(candidate, best_experiment):
            best_experiment = candidate

    if best_experiment is None:
        return

    best_result = best_experiment["result"]
    for point in best_experiment["history"]:
        db.add(JobHistory(job_id=job.id, **point))

    job.computation_time_ms = round((_time.time() - run_start) * 1000, 2)
    job.t_start = float(N)
    job.t_end = float(num_iterations)
    job.compute_device = "gpu" if best_result.get("device") in ("gpu", "cuda") else "cpu"

    if Q is not None:
        total_vars = int(Q.shape[0])
        n_items = len(raw.get("items", [])) if qubo_type == "knapsack" else 0
        n_slack = total_vars - n_items
    elif use_cuda and qubo_type == "knapsack":
        n_items = len(raw.get("items", []))
        _cap = float(raw.get("max_weight") or raw.get("capacity", 0))
        _auto_K = max(1, math.ceil(math.log2(_cap + 1))) if _cap > 0 else 1
        n_slack = int(raw.get("slack_bits") or _auto_K)
        total_vars = n_items + n_slack
    else:
        total_vars = n_slack = 0

    if total_vars > 0:
        job.n_variables = total_vars
    _pd = dict(job.problem_data or {})
    if n_slack > 0:
        _pd["n_slack"] = n_slack

    if qubo_type == "knapsack":
        items_list = raw.get("items", [])
        solution   = best_result.get("solution", [])
        selected   = [
            {"name": it["name"], "weight": it["weight"], "value": it["value"]}
            for it, xi in zip(items_list, solution) if xi
        ]
        _pd["selected_items"] = selected
        _pd["total_value"]    = round(sum(float(s["value"])  for s in selected), 6)
        _pd["total_weight"]   = round(sum(float(s["weight"]) for s in selected), 6)

    _pd["experiment_count"] = experiment_count
    _pd["completed_experiments"] = experiment_count
    _pd["best_experiment"] = best_experiment["index"]
    _pd["best_theta"] = best_experiment["theta"]
    job.problem_data = _pd
    flag_modified(job, "problem_data")

    db.commit()
    return best_result
