# -*- coding: utf-8 -*-

import argparse
import csv
import sys


def generate_items(n_items):
    """
    依照 Case 3 規則產生背包資料集。

    規則：
    1. weight = 1, 2, 3, ..., 10 循環
    2. value = weight + 5
    3. capacity = sum(weight) / 2
    """

    rows = []

    for i in range(n_items):
        item_id = i + 1
        weight = (i % 10) + 1
        value = weight + 5

        rows.append({
            "name": "item-{0:03d}".format(item_id),
            "weight": weight,
            "value": value
        })

    total_weight = sum(row["weight"] for row in rows)
    capacity = total_weight / 2

    return rows, total_weight, capacity


def save_as_csv(rows, output_path):
    """
    輸出 CSV 檔案。
    欄位格式：
    name, weight, value
    """

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "weight", "value"])
        writer.writeheader()
        writer.writerows(rows)


def get_n_items_from_user():
    """
    讓使用者輸入物品數量。
    """

    while True:
        user_input = input("請輸入物品數量 n_items：").strip()

        try:
            n_items = int(user_input)
        except ValueError:
            print("請輸入整數。")
            continue

        if n_items <= 0:
            print("物品數量必須大於 0。")
            continue

        return n_items


def main():
    parser = argparse.ArgumentParser(
        description="Generate Case 3 knapsack CSV dataset."
    )

    parser.add_argument(
        "-n",
        "--n_items",
        type=int,
        default=None,
        help="物品數量，例如：100、1000、3000"
    )

    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default=None,
        help="輸出檔名，例如：case3_items_100.csv"
    )

    args = parser.parse_args()

    if args.n_items is None:
        n_items = get_n_items_from_user()
    else:
        n_items = args.n_items

    if n_items <= 0:
        print("錯誤：物品數量必須大於 0。")
        sys.exit(1)

    rows, total_weight, capacity = generate_items(n_items)

    if args.output is None:
        output_path = "case3_items_{0}.csv".format(n_items)
    else:
        output_path = args.output

        if not output_path.lower().endswith(".csv"):
            output_path += ".csv"

    save_as_csv(rows, output_path)

    print("資料集產生完成。")
    print("物品數量：{0}".format(n_items))
    print("總重量 total_weight：{0}".format(total_weight))
    print("背包容量 capacity = total_weight / 2：{0}".format(capacity))
    print("輸出檔案：{0}".format(output_path))


if __name__ == "__main__":
    main()