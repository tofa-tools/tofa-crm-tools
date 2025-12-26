# WSGI Configuration Guide for PythonAnywhere

This guide explains exactly what values you need to change in the WSGI file.

## Values You MUST Change

### 1. DATABASE_URL (Line 120)

**Replace this:**
```python
os.environ['DATABASE_URL'] = 'postgresql://user:password@host:port/database'
```

**With your actual database connection string:**

#### If using Supabase:
1. Go to your Supabase project dashboard
2. Click on **Settings** → **Database**
3. Scroll down to **Connection string** section
4. Copy the **URI** (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)
5. Replace `[YOUR-PASSWORD]` with your actual database password

**Example:**
```python
os.environ['DATABASE_URL'] = 'postgresql://postgres:MySecurePassword123@db.abcdefghijklmnop.supabase.co:5432/postgres'
```

#### If using other PostgreSQL:
```python
os.environ['DATABASE_URL'] = 'postgresql://username:password@host:5432/database_name'
```

**Format:** `postgresql://username:password@host:port/database_name`

---

### 2. SECRET_KEY (Line 121)

**Replace this:**
```python
os.environ['SECRET_KEY'] = 'your-secret-key'
```

**With a secure random string.**

#### How to generate a secure SECRET_KEY:

**Option A: Using Python (Recommended)**
```bash
# In PythonAnywhere console or your local terminal
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

This will output something like:
```
Xk8pL9mN2qR4sT6vW8yZ0bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG
```

**Copy the output and use it:**
```python
os.environ['SECRET_KEY'] = 'Xk8pL9mN2qR4sT6vW8yZ0bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG'
```

**Option B: Using online generator**
- Go to https://randomkeygen.com/
- Use a "CodeIgniter Encryption Keys" (256-bit key)
- Copy and use that

**Option C: Simple random string (less secure but works)**
```python
os.environ['SECRET_KEY'] = 'my-super-secret-key-change-this-to-something-random-and-long-12345'
```

⚠️ **Important:** Use a long, random string. Don't use simple passwords or dictionary words!

---

### 3. USERNAME (Multiple places)

**Replace `yourusername` with your actual PythonAnywhere username:**

```python
path = '/home/yourusername/tofa-crm'  # Change 'yourusername' here
activate_this = '/home/yourusername/tofa-crm/venv/bin/activate_this.py'  # And here
```

**Example:** If your PythonAnywhere username is `johnsmith`:
```python
path = '/home/johnsmith/tofa-crm'
activate_this = '/home/johnsmith/tofa-crm/venv/bin/activate_this.py'
```

---

## Values You DON'T Need to Change

These are fine as-is:

```python
os.environ['ALGORITHM'] = 'HS256'  # Keep this
os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'] = '60'  # Keep this (or change if you want different expiration)
```

---

## Complete Example

Here's what a properly configured WSGI file looks like (example):

```python
import sys
import os

# Add your project directory to the path
path = '/home/johnsmith/tofa-crm'  # ← Changed: yourusername → johnsmith
if path not in sys.path:
    sys.path.insert(0, path)

# Set environment variables
os.environ['DATABASE_URL'] = 'postgresql://postgres:MyPassword123@db.abcdefgh.supabase.co:5432/postgres'  # ← Changed: Your actual database URL
os.environ['SECRET_KEY'] = 'Xk8pL9mN2qR4sT6vW8yZ0bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG'  # ← Changed: Your generated secret key
os.environ['ALGORITHM'] = 'HS256'  # ← Keep this
os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'] = '60'  # ← Keep this

# Activate virtual environment
activate_this = '/home/johnsmith/tofa-crm/venv/bin/activate_this.py'  # ← Changed: yourusername → johnsmith
with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

# Import your FastAPI app
from backend.main import app as application

if __name__ == "__main__":
    application.run()
```

---

## Quick Checklist

Before saving your WSGI file, make sure you've changed:

- [ ] `yourusername` → Your PythonAnywhere username (2 places)
- [ ] `postgresql://user:password@host:port/database` → Your actual DATABASE_URL
- [ ] `your-secret-key` → A secure random SECRET_KEY

---

## Troubleshooting

### "Module not found" errors
- Check that your username path is correct
- Verify project is cloned to `/home/YOUR_USERNAME/tofa-crm`

### "Database connection failed"
- Check DATABASE_URL format is correct
- Verify password doesn't have special characters that need URL encoding
- Test connection string locally first

### "Invalid SECRET_KEY"
- Make sure SECRET_KEY is a string (in quotes)
- Use a longer, more random string if getting authentication errors

---

## Security Note

⚠️ **Never commit your WSGI file with real credentials to Git!**

The WSGI file on PythonAnywhere is private, but if you ever copy it, make sure to replace sensitive values before sharing.

