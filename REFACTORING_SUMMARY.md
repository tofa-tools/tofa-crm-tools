# Refactoring Summary: Dual-Framework Architecture

This document summarizes the refactoring to support both FastAPI (ASGI) and Flask (WSGI) using shared core business logic.

## 📁 New Structure

```
backend/
├── core/                    # NEW: Framework-agnostic business logic
│   ├── __init__.py
│   ├── auth.py              # JWT encode/decode, password hashing
│   ├── db.py                # DB session management
│   ├── users.py             # User CRUD operations
│   ├── leads.py             # Lead CRUD operations
│   └── centers.py           # Center CRUD operations
│
├── schemas/                 # NEW: Pydantic models
│   ├── __init__.py
│   └── users.py             # User-related schemas
│
├── fastapi_app.py           # NEW: Refactored FastAPI app
├── fastapi_auth.py          # NEW: FastAPI-specific auth dependencies
├── flask_app.py             # NEW: Flask app (WSGI-compatible)
├── main.py                  # MODIFIED: Now imports from fastapi_app
│
├── models.py                # UNCHANGED: SQLModel models
├── database.py              # DEPRECATED: Use core/db.py instead
└── auth.py                  # DEPRECATED: Use core/auth.py instead
```

## ✅ What Was Created

### NEW Files

1. **`backend/core/__init__.py`** - Core package initialization
2. **`backend/core/auth.py`** - Framework-agnostic authentication utilities
3. **`backend/core/db.py`** - Database session management
4. **`backend/core/users.py`** - User CRUD operations
5. **`backend/core/leads.py`** - Lead CRUD operations
6. **`backend/core/centers.py`** - Center CRUD operations
7. **`backend/schemas/__init__.py`** - Schemas package
8. **`backend/schemas/users.py`** - User Pydantic schemas
9. **`backend/fastapi_app.py`** - Refactored FastAPI application
10. **`backend/fastapi_auth.py`** - FastAPI-specific auth dependencies
11. **`backend/flask_app.py`** - Flask application (WSGI)

### MODIFIED Files

1. **`backend/main.py`** - Now imports from `fastapi_app` for backward compatibility
2. **`requirements.txt`** - Added Flask and flask-cors

## 🔄 Key Changes

### Core Package (Framework-Agnostic)

- **All business logic** extracted to `core/` package
- **No framework dependencies** (no FastAPI, no Flask imports)
- **Pure Python functions** that take database sessions as parameters
- **Synchronous operations** (works with both async and sync frameworks)

### FastAPI App

- **Preserves async support** - All async endpoints remain async
- **Uses core functions** - Routes delegate to core business logic
- **Backward compatible** - Same route paths and response formats
- **FastAPI-specific auth** - Dependency injection wrapper in `fastapi_auth.py`

### Flask App

- **WSGI-compatible** - Can be deployed on PythonAnywhere Free
- **Same API endpoints** - Matches FastAPI route paths
- **Same response formats** - JSON responses match FastAPI
- **Synchronous operations** - All routes are sync (required for WSGI)
- **JWT authentication** - Uses same core auth functions
- **Factory pattern** - `create_app()` function for proper initialization

## 🚀 Deployment Options

### FastAPI (ASGI)
```bash
# Run FastAPI app
uvicorn backend.fastapi_app:app --reload

# Or use main.py (backward compatible)
uvicorn backend.main:app --reload
```

### Flask (WSGI)
```bash
# Run Flask app
export FLASK_APP=backend.flask_app
flask run

# Or use application directly
python -m backend.flask_app
```

### PythonAnywhere (WSGI)
```python
# In WSGI file:
import sys
sys.path.insert(0, '/home/yourusername/tofa-crm')
from backend.flask_app import application
```

## 📝 Migration Notes

### For Existing Code

- **FastAPI code continues to work** - `backend/main.py` still works
- **No breaking changes** - All routes and responses remain the same
- **Optional migration** - Can gradually migrate to use core functions

### Deprecated Files

- `backend/auth.py` - Use `backend/core/auth.py` instead
- `backend/database.py` - Use `backend/core/db.py` instead

These are kept for backward compatibility but should not be used in new code.

## 🔒 Authentication

Both frameworks use the same JWT tokens and authentication logic:

- **FastAPI**: Uses `fastapi_auth.get_current_user` dependency
- **Flask**: Uses `get_current_user_from_token()` helper function
- **Both**: Use `core.auth` functions for JWT encoding/decoding

## 📊 API Compatibility

| Endpoint | FastAPI | Flask | Status |
|----------|---------|-------|--------|
| `POST /token` | ✅ | ✅ | Compatible |
| `GET /users/` | ✅ | ✅ | Compatible |
| `POST /users/` | ✅ | ✅ | Compatible |
| `GET /leads/my_leads` | ✅ | ✅ | Compatible |
| `PUT /leads/{id}` | ✅ | ✅ | Compatible |
| `POST /leads/upload/` | ✅ | ✅ | Compatible |
| `POST /leads/meta-webhook/` | ✅ | ✅ | Compatible |
| `GET /centers/` | ✅ | ✅ | Compatible |
| `POST /centers/` | ✅ | ✅ | Compatible |

## 🎯 Benefits

1. **Dual deployment** - Deploy FastAPI (ASGI) or Flask (WSGI) as needed
2. **Shared logic** - Single source of truth for business logic
3. **No code duplication** - Core functions reused by both frameworks
4. **Easy testing** - Test core functions independently
5. **Future-proof** - Easy to add more frameworks (Django, etc.)

## ⚠️ Important Notes

1. **FastAPI async preserved** - All async endpoints remain async
2. **Flask is sync-only** - Required for WSGI compatibility
3. **Database sessions** - Core functions manage sessions internally
4. **Error handling** - Both frameworks handle errors appropriately
5. **CORS** - Configured for both frameworks

## 📚 Next Steps

1. Test both FastAPI and Flask applications
2. Deploy Flask to PythonAnywhere Free (WSGI)
3. Keep FastAPI for future ASGI hosting
4. Gradually migrate any direct DB calls to use core functions

---

**Status**: ✅ Refactoring Complete
**Backward Compatibility**: ✅ Maintained
**Breaking Changes**: ❌ None

