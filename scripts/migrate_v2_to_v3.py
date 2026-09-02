#!/usr/bin/env python3
"""
scripts/migrate_v2_to_v3.py
v2.0 → v3.0 数据迁移脚本

⚠️ Phase 0 占位 · 等 Mark 拍板"迁移范围"后再执行

迁移策略：
1. 用户邮箱：从 v2.0 users 导出邮箱 + 昵称 → v3.0 users（email_verified=1）
2. 历史订单：从 v2.0 orders 导出（user_email 关联）→ v3.0 orders
3. 历史解读：从 v2.0 readings 导出（user_email 关联）→ v3.0 readings
4. 边界：同一邮箱多账号、无邮箱访客订单、设备 ID 关联等

执行命令：
  python3 migrate_v2_to_v3.py --dry-run   # 仅检查，不写入
  python3 migrate_v2_to_v3.py             # 实际迁移
"""

import sqlite3
import argparse
from pathlib import Path
from datetime import datetime

V2_DB = Path.home() / "Desktop" / "tarot-app" / "server" / "data" / "tarot.db"
V3_DB = Path.home() / "Desktop" / "tarot-app" / "v3" / "server" / "data" / "tarot_v3.db"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="仅检查，不写入")
    parser.add_argument("--v2-db", default=str(V2_DB))
    parser.add_argument("--v3-db", default=str(V3_DB))
    args = parser.parse_args()

    if not Path(args.v2_db).exists():
        print(f"❌ v2 DB 不存在: {args.v2_db}")
        return

    if not Path(args.v3_db).exists():
        print(f"❌ v3 DB 不存在: {args.v3_db}")
        print(f"   先执行: bash scripts/init_db.sh")
        return

    print(f"[migrate] v2: {args.v2_db}")
    print(f"[migrate] v3: {args.v3_db}")
    print(f"[migrate] dry_run: {args.dry_run}")

    v2 = sqlite3.connect(args.v2_db)
    v3 = sqlite3.connect(args.v3_db)

    # 1. 统计 v2 数据
    user_count = v2.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    order_count = v2.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    reading_count = v2.execute("SELECT COUNT(*) FROM readings").fetchone()[0]

    print(f"\n[migrate] v2 数据统计：")
    print(f"  users: {user_count}")
    print(f"  orders: {order_count}")
    print(f"  readings: {reading_count}")

    # TODO Phase 0+: 实现实际迁移逻辑
    # - 邮箱匹配 → 创建 v3 user
    # - 订单按 user_email 关联
    # - 解读按 user_email 关联

    print(f"\n[migrate] ⚠️  Phase 0 占位：实际迁移逻辑待 Mark 拍板'迁移范围'后实现")
    print(f"[migrate] 待确认：")
    print(f"  - 是否迁移访客订单（无邮箱）？")
    print(f"  - 是否迁移未支付订单？")
    print(f"  - 同一邮箱多 v2 账号如何合并？")
    print(f"  - 迁移后是否带'V2 迁移'标识？")


if __name__ == "__main__":
    main()
