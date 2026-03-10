"""
SQLite database layer using aiosqlite for async access.
Schema: properties, documents, conversations, messages
"""
import json
import os
import aiosqlite
from contextlib import asynccontextmanager
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "flipper.db"))


@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        yield db


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                status TEXT DEFAULT 'analyzing',
                purchase_price REAL,
                repair_costs REAL,
                arv REAL,
                holding_months INTEGER DEFAULT 6,
                monthly_holding_cost REAL DEFAULT 1500,
                loan_amount REAL DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                doc_type TEXT DEFAULT 'general',
                extracted_text TEXT,
                summary TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
                title TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
        """)
        await db.commit()


# --- Properties ---

async def create_property(data: dict) -> dict:
    async with get_db() as db:
        cursor = await db.execute(
            """INSERT INTO properties (name, address, status, purchase_price, repair_costs,
               arv, holding_months, monthly_holding_cost, loan_amount, notes)
               VALUES (:name, :address, :status, :purchase_price, :repair_costs,
               :arv, :holding_months, :monthly_holding_cost, :loan_amount, :notes)""",
            {
                "name": data.get("name", "Unnamed Property"),
                "address": data.get("address"),
                "status": data.get("status", "analyzing"),
                "purchase_price": data.get("purchase_price"),
                "repair_costs": data.get("repair_costs"),
                "arv": data.get("arv"),
                "holding_months": data.get("holding_months", 6),
                "monthly_holding_cost": data.get("monthly_holding_cost", 1500),
                "loan_amount": data.get("loan_amount", 0),
                "notes": data.get("notes"),
            }
        )
        await db.commit()
        return await get_property(cursor.lastrowid)


async def get_property(property_id: int) -> dict | None:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM properties WHERE id = ?", (property_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_properties() -> list[dict]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM properties ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def update_property(property_id: int, data: dict) -> dict | None:
    fields = []
    values = {}
    allowed = ["name", "address", "status", "purchase_price", "repair_costs", "arv",
               "holding_months", "monthly_holding_cost", "loan_amount", "notes"]
    for key in allowed:
        if key in data:
            fields.append(f"{key} = :{key}")
            values[key] = data[key]
    if not fields:
        return await get_property(property_id)
    values["id"] = property_id
    values["updated_at"] = datetime.utcnow().isoformat()
    async with get_db() as db:
        await db.execute(
            f"UPDATE properties SET {', '.join(fields)}, updated_at = :updated_at WHERE id = :id",
            values
        )
        await db.commit()
    return await get_property(property_id)


async def delete_property(property_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM properties WHERE id = ?", (property_id,))
        await db.commit()


# --- Documents ---

async def save_document(property_id: int | None, filename: str, file_path: str,
                        doc_type: str, extracted_text: str = "", summary: str = "") -> dict:
    async with get_db() as db:
        cursor = await db.execute(
            """INSERT INTO documents (property_id, filename, file_path, doc_type, extracted_text, summary)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (property_id, filename, file_path, doc_type, extracted_text, summary)
        )
        await db.commit()
        doc_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = await cursor.fetchone()
        return dict(row)


async def get_documents(property_id: int | None = None) -> list[dict]:
    async with get_db() as db:
        if property_id is not None:
            cursor = await db.execute(
                "SELECT * FROM documents WHERE property_id = ? ORDER BY created_at DESC",
                (property_id,)
            )
        else:
            cursor = await db.execute("SELECT * FROM documents ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_document(doc_id: int) -> dict | None:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_document_summary(doc_id: int, summary: str):
    async with get_db() as db:
        await db.execute("UPDATE documents SET summary = ? WHERE id = ?", (summary, doc_id))
        await db.commit()


# --- Conversations ---

async def create_conversation(property_id: int | None = None, title: str = "New Chat") -> dict:
    async with get_db() as db:
        cursor = await db.execute(
            "INSERT INTO conversations (property_id, title) VALUES (?, ?)",
            (property_id, title)
        )
        await db.commit()
        conv_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
        row = await cursor.fetchone()
        return dict(row)


async def get_conversation(conv_id: int) -> dict | None:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_conversations(property_id: int | None = None) -> list[dict]:
    async with get_db() as db:
        if property_id is not None:
            cursor = await db.execute(
                "SELECT * FROM conversations WHERE property_id = ? ORDER BY updated_at DESC",
                (property_id,)
            )
        else:
            cursor = await db.execute("SELECT * FROM conversations ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def add_message(conv_id: int, role: str, content: str) -> dict:
    async with get_db() as db:
        cursor = await db.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conv_id, role, content)
        )
        await db.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conv_id,)
        )
        await db.commit()
        msg_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
        row = await cursor.fetchone()
        return dict(row)


async def get_messages(conv_id: int) -> list[dict]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def update_conversation_title(conv_id: int, title: str):
    async with get_db() as db:
        await db.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, conv_id))
        await db.commit()
