"""Optional SQL Server integration (shared database with the Arena game).

Same keys, same database (CyberSecurity2025, CSS schema) and same stored
procedures as Cybersecurity2026---Game, so both games persist to one place.
If DB_SERVER is unset, everything degrades to local JSON persistence.
"""

from __future__ import annotations

import os
import sys
from typing import Any


class SqlGateway:
    def __init__(self) -> None:
        self.enabled = bool(os.environ.get("DB_SERVER"))
        self._pyodbc: Any = None
        self._connection_string = ""
        self._driver = os.environ.get("DB_DRIVER", "SQL Server")
        self._driver_available = False
        self._last_operation = "not_started"
        self._last_error = ""
        if self.enabled:
            self._load_driver()

    def _load_driver(self) -> None:
        try:
            import pyodbc
        except ImportError as error:
            raise RuntimeError(
                "SQL Server is configured, but pyodbc is not installed for "
                f"{sys.executable}. Install it into this Python interpreter."
            ) from error
        self._pyodbc = pyodbc
        self._driver_available = self._driver in pyodbc.drivers()
        server = os.environ["DB_SERVER"]
        port = os.environ.get("DB_PORT", "").strip()
        database = os.environ.get("DB_NAME", "CyberSecurity2025")
        server_target = f"{server},{port}" if port else server
        encrypt = os.environ.get("DB_ENCRYPT", "false").strip().lower() in {"1", "true", "yes"}
        trust_server_certificate = (
            os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "true").strip().lower()
            in {"1", "true", "yes"}
        )
        self._connection_string = (
            f"DRIVER={{{self._driver}}};SERVER={server_target};DATABASE={database};"
            f"UID={os.environ.get('DB_USER', '')};PWD={os.environ.get('DB_PASSWORD', '')};"
            f"Encrypt={'yes' if encrypt else 'no'};"
            f"TrustServerCertificate={'yes' if trust_server_certificate else 'no'};"
        )

    def _connect(self) -> Any:
        if not self.enabled or self._pyodbc is None:
            return None
        if not self._driver_available:
            raise RuntimeError(
                f"ODBC driver '{self._driver}' is not installed. "
                f"Available drivers: {', '.join(self._pyodbc.drivers()) or 'none'}"
            )
        return self._pyodbc.connect(self._connection_string, timeout=5)

    def diagnostics(self) -> dict[str, Any]:
        """Return configuration and the latest SQL result without exposing credentials."""
        return {
            "enabled": self.enabled,
            "driver": self._driver,
            "driverAvailable": self._driver_available,
            "server": os.environ.get("DB_SERVER", ""),
            "portConfigured": bool(os.environ.get("DB_PORT", "").strip()),
            "database": os.environ.get("DB_NAME", ""),
            "userConfigured": bool(os.environ.get("DB_USER", "").strip()),
            "passwordConfigured": bool(os.environ.get("DB_PASSWORD", "")),
            "lastOperation": self._last_operation,
            "lastError": self._last_error,
        }

    def validate_and_register(
        self, emp_id: str, fallback_name: str, fallback_dept: str
    ) -> dict[str, Any]:
        local_profile = {
            "empId": emp_id,
            "name": fallback_name,
            "dept": fallback_dept,
            "validated": False,
            "source": "local",
        }
        if not self.enabled:
            return local_profile

        try:
            numeric_emp_id = int(emp_id)
        except ValueError as error:
            raise ValueError("Employee ID must be numeric.") from error

        connection = None
        self._last_operation = "validate_and_register"
        self._last_error = ""
        try:
            connection = self._connect()
            cursor = connection.cursor()
            cursor.execute(
                """
                SELECT TOP 1 EmpID, FullName, DepartmentID, DepartmentName, BranchID
                FROM CSS.mSystemUsers
                WHERE EmpID = ?
                """,
                numeric_emp_id,
            )
            row = cursor.fetchone()
            if row is None:
                raise ValueError("Employee ID was not found in the system users directory.")

            profile = {
                "empId": str(row.EmpID),
                "name": (row.FullName or fallback_name).strip(),
                "dept": (row.DepartmentName or fallback_dept).strip(),
                "departmentId": row.DepartmentID,
                "branchId": row.BranchID or "",
                "validated": True,
                "source": "sql",
            }
            cursor.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM CSS.mCyberSecPlayers WHERE EmpID = ?)
                BEGIN
                    INSERT INTO CSS.mCyberSecPlayers
                        (EmpID, FullName, PlayerID, DepartmentID, DepartmentName, BranchID, DateCreated)
                    SELECT ?, ?, ISNULL(MAX(PlayerID), 0) + 1, ?, ?, ?, GETDATE()
                    FROM CSS.mCyberSecPlayers
                END
                """,
                numeric_emp_id,
                numeric_emp_id,
                profile["name"],
                profile["departmentId"],
                profile["dept"],
                profile["branchId"],
            )
            connection.commit()
            self.ensure_arena_player(profile)
            return profile
        except (self._pyodbc.Error, RuntimeError) as error:
            self._last_error = str(error)
            print(f"[SQL] Employee validation unavailable; using local profile: {error}")
            return local_profile
        finally:
            if connection is not None:
                connection.close()

    def ensure_arena_player(self, profile: dict[str, Any]) -> None:
        if not self.enabled:
            return
        connection = None
        self._last_operation = "ensure_arena_player"
        self._last_error = ""
        try:
            connection = self._connect()
            cursor = connection.cursor()
            cursor.execute(
                "{CALL CSS.sp_CyberMonArena_EnsurePlayer (?, ?, ?)}",
                str(profile["empId"]),
                str(profile["name"])[:50],
                str(profile["dept"])[:100],
            )
            connection.commit()
        except (self._pyodbc.Error, RuntimeError) as error:
            self._last_error = str(error)
            print(f"[SQL] Arena player registration skipped: {error}")
        finally:
            if connection is not None:
                connection.close()

    def record_arena_battle(
        self,
        *,
        match_id: str,
        winner: dict[str, Any],
        loser: dict[str, Any],
        winner_points: int,
        loser_points: int,
        is_pvp: bool,
    ) -> None:
        if not self.enabled:
            return
        connection = None
        self._last_operation = "record_arena_battle"
        self._last_error = ""
        try:
            connection = self._connect()
            cursor = connection.cursor()
            cursor.execute(
                "{CALL CSS.sp_CyberMonArena_RecordBattle "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)}",
                match_id,
                winner.get("empId"),
                str(winner.get("name", "Anonymous"))[:50],
                str(winner.get("dept", "General"))[:100],
                loser.get("empId"),
                str(loser.get("name", "Anonymous"))[:50],
                str(loser.get("dept", "General"))[:100],
                winner_points,
                loser_points,
                is_pvp,
                winner.get("monster", {}).get("name"),
                loser.get("monster", {}).get("name"),
            )
            connection.commit()
        except (self._pyodbc.Error, RuntimeError) as error:
            self._last_error = str(error)
            raise RuntimeError(f"SQL Arena battle write failed: {error}") from error
        finally:
            if connection is not None:
                connection.close()

    def get_arena_leaderboard(self, top: int = 10) -> list[dict[str, Any]] | None:
        if not self.enabled:
            return None
        connection = None
        self._last_operation = "get_arena_leaderboard"
        self._last_error = ""
        try:
            connection = self._connect()
            cursor = connection.cursor()
            cursor.execute("{CALL CSS.sp_CyberMonArena_GetLeaderboard (?)}", top)
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except (self._pyodbc.Error, RuntimeError) as error:
            self._last_error = str(error)
            print(f"[SQL] Arena leaderboard read skipped: {error}")
            return None
        finally:
            if connection is not None:
                connection.close()

    def get_arena_departments(self) -> list[dict[str, Any]] | None:
        if not self.enabled:
            return None
        connection = None
        self._last_operation = "get_arena_departments"
        self._last_error = ""
        try:
            connection = self._connect()
            cursor = connection.cursor()
            cursor.execute("{CALL CSS.sp_CyberMonArena_GetDepartmentLeaderboard}")
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except (self._pyodbc.Error, RuntimeError) as error:
            self._last_error = str(error)
            print(f"[SQL] Arena department read skipped: {error}")
            return None
        finally:
            if connection is not None:
                connection.close()
