"""
Flask application using core business logic.
Deployable on PythonAnywhere Free (WSGI-compatible).
All routes match FastAPI paths and response shapes.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from typing import Optional
import pandas as pd
from io import BytesIO

from backend.core.db import get_session_sync, create_db_and_tables
from backend.core.auth import create_access_token, get_user_email_from_token
from backend.core.users import verify_user_credentials, create_user, get_all_users, get_user_by_email
from backend.core.leads import (
    get_leads_for_user, update_lead, create_lead_from_meta, import_leads_from_dataframe
)
from backend.core.centers import get_all_centers, create_center
from backend.models import User, Center


def create_app() -> Flask:
    """Flask application factory."""
    app = Flask(__name__)
    
    # CORS configuration
    CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"], supports_credentials=True)
    
    # Initialize database (call on first request)
    def init_db_once():
        """Initialize database tables and admin user."""
        if not hasattr(app, '_db_initialized'):
            create_db_and_tables()
            # Create admin user if needed
            db = get_session_sync()
            try:
                admin = get_user_by_email(db, "admin@tofa.com")
                if not admin:
                    from backend.core.auth import get_password_hash
                    new_admin = User(
                        email="admin@tofa.com",
                        hashed_password=get_password_hash("admin123"),
                        full_name="Super Admin",
                        role="team_lead"
                    )
                    db.add(new_admin)
                    db.commit()
                    print("--- Admin Created: admin@tofa.com / admin123 ---")
            except Exception as e:
                print(f"Database check failed: {e}")
            finally:
                db.close()
            app._db_initialized = True
    
    @app.before_request
    def before_request():
        """Initialize DB on first request."""
        init_db_once()
    
    # Authentication helper
    def get_current_user_from_token() -> Optional[User]:
        """Extract and validate user from JWT token."""
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        email = get_user_email_from_token(token)
        if not email:
            return None
        
        db = get_session_sync()
        try:
            user = get_user_by_email(db, email)
            return user
        finally:
            db.close()
    
    def require_auth(f):
        """Decorator to require authentication."""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user_from_token()
            if not user:
                return jsonify({"detail": "Not authenticated"}), 401
            # Pass user as first argument if function expects it
            import inspect
            sig = inspect.signature(f)
            if 'user' in sig.parameters:
                return f(user, *args, **kwargs)
            return f(*args, **kwargs)
        return decorated_function
    
    def require_team_lead(f):
        """Decorator to require team_lead role."""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user_from_token()
            if not user:
                return jsonify({"detail": "Not authenticated"}), 401
            if user.role != "team_lead":
                return jsonify({"detail": "Not authorized"}), 403
            # Pass user as first argument if function expects it
            import inspect
            sig = inspect.signature(f)
            if 'user' in sig.parameters:
                return f(user, *args, **kwargs)
            return f(*args, **kwargs)
        return decorated_function
    
    # --- AUTHENTICATION ---
    @app.route("/token", methods=["POST"])
    def login():
        """Login endpoint - returns JWT token (OAuth2 password form)."""
        if request.content_type and 'application/x-www-form-urlencoded' in request.content_type:
            email = request.form.get('username')
            password = request.form.get('password')
        else:
            data = request.get_json() or {}
            email = data.get('username') or data.get('email')
            password = data.get('password')
        
        if not email or not password:
            return jsonify({"detail": "Email and password required"}), 400
        
        db = get_session_sync()
        try:
            user = verify_user_credentials(db, email, password)
            if not user:
                return jsonify({"detail": "Incorrect email or password"}), 400
            
            access_token = create_access_token(data={"sub": user.email, "role": user.role})
            return jsonify({
                "access_token": access_token,
                "token_type": "bearer",
                "role": user.role
            })
        finally:
            db.close()
    
    # --- USER MANAGEMENT ---
    @app.route("/users/", methods=["POST"])
    @require_team_lead
    def create_user_endpoint(user=None):
        """Create a new user (team leads only)."""
        data = request.get_json()
        if not data:
            return jsonify({"detail": "Request body required"}), 400
        
        db = get_session_sync()
        try:
            new_user = create_user(
                db=db,
                email=data.get('email'),
                password=data.get('password'),
                full_name=data.get('full_name'),
                role=data.get('role'),
                center_ids=data.get('center_ids', [])
            )
            return jsonify({"status": "User created successfully"})
        except ValueError as e:
            return jsonify({"detail": str(e)}), 400
        finally:
            db.close()
    
    @app.route("/users/", methods=["GET"])
    @require_team_lead
    def read_users(user=None):
        """Get all users (team leads only)."""
        db = get_session_sync()
        try:
            users = get_all_users(db)
            # Convert SQLModel objects to dicts
            users_list = []
            for u in users:
                users_list.append({
                    "id": u.id,
                    "email": u.email,
                    "full_name": u.full_name,
                    "role": u.role
                })
            return jsonify(users_list)
        finally:
            db.close()
    
    # --- LEADS ---
    @app.route("/leads/my_leads", methods=["GET"])
    @require_auth
    def get_my_leads():
        """Get leads for the current user."""
        user = get_current_user_from_token()
        db = get_session_sync()
        try:
            leads = get_leads_for_user(db, user)
            return jsonify([{
                "id": l.id,
                "created_time": l.created_time.isoformat() if l.created_time else None,
                "player_name": l.player_name,
                "player_age_category": l.player_age_category,
                "phone": l.phone,
                "email": l.email,
                "address": l.address,
                "status": l.status,
                "next_followup_date": l.next_followup_date.isoformat() if l.next_followup_date else None,
                "center_id": l.center_id
            } for l in leads])
        finally:
            db.close()
    
    @app.route("/leads/<int:lead_id>", methods=["PUT"])
    @require_auth
    def update_lead_endpoint(lead_id: int):
        """Update a lead's status and add optional comment."""
        user = get_current_user_from_token()
        status = request.args.get('status')
        next_date = request.args.get('next_date')
        comment = request.args.get('comment')
        
        if not status:
            return jsonify({"detail": "Status parameter required"}), 400
        
        db = get_session_sync()
        try:
            updated_lead = update_lead(
                db=db,
                lead_id=lead_id,
                status=status,
                next_date=next_date,
                comment=comment,
                user_id=user.id
            )
            return jsonify({"status": "updated"})
        except ValueError as e:
            return jsonify({"detail": str(e)}), 404
        finally:
            db.close()
    
    @app.route("/leads/upload/", methods=["POST"])
    @require_team_lead
    def upload_leads(user=None):
        """Upload leads from Excel/CSV file (team leads only)."""
        if 'file' not in request.files:
            return jsonify({"detail": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"detail": "No file selected"}), 400
        
        file_extension = file.filename.split('.')[-1].lower()
        
        try:
            file_content = file.read()
            file_io = BytesIO(file_content)
            
            if file_extension in ['xlsx', 'xls']:
                df = pd.read_excel(file_io)
            elif file_extension == 'csv':
                file_io.seek(0)
                try:
                    df = pd.read_csv(file_io, encoding='utf-8')
                except UnicodeDecodeError:
                    file_io.seek(0)
                    try:
                        df = pd.read_csv(file_io, encoding='latin-1')
                    except:
                        file_io.seek(0)
                        df = pd.read_csv(file_io, encoding='cp1252')
            else:
                return jsonify({
                    "detail": f"Unsupported file type. Please upload Excel (.xlsx, .xls) or CSV (.csv) files"
                }), 400
            
            meta_col = "_which_is_the_nearest_tofa_center_to_you?"
            if meta_col not in df.columns:
                possible_cols = [c for c in df.columns if "nearest_tofa" in str(c)]
                meta_col = possible_cols[0] if possible_cols else None
            
            if not meta_col:
                return jsonify({"detail": "Could not find Center/Location column"}), 400
            
            db = get_session_sync()
            try:
                count, unknown_tags = import_leads_from_dataframe(db, df, meta_col)
                if unknown_tags:
                    return jsonify({
                        "status": "error",
                        "message": "Unknown Centers Found",
                        "unknown_tags": unknown_tags
                    })
                return jsonify({"status": "success", "leads_added": count})
            except Exception as e:
                return jsonify({"detail": str(e)}), 400
            finally:
                db.close()
        except Exception as e:
            return jsonify({"detail": f"Error reading file: {str(e)}"}), 400
    
    @app.route("/leads/meta-webhook/", methods=["POST"])
    def meta_webhook():
        """Webhook endpoint for Meta Lead Forms."""
        data = request.get_json() or {}
        try:
            phone = str(data.get("phone_number", "")).strip()
            name = data.get("full_name", "Unknown").strip()
            email = data.get("email_address", "").strip() or None
            center_tag = data.get("nearest_center", "").strip()
            age_category = data.get("player_age_category", "Unknown").strip()
            address = data.get("address_and_pincode", "").strip() or None
            
            if not phone:
                return jsonify({"status": "error", "message": "Phone number is required"})
            
            if not center_tag:
                return jsonify({"status": "error", "message": "Center/Location is required"})
            
            db = get_session_sync()
            try:
                new_lead = create_lead_from_meta(
                    db=db,
                    phone=phone,
                    name=name,
                    email=email,
                    center_tag=center_tag,
                    age_category=age_category,
                    address=address
                )
                return jsonify({
                    "status": "success",
                    "message": "Lead created successfully",
                    "lead_id": new_lead.id
                })
            except ValueError as e:
                return jsonify({"status": "error", "message": str(e)})
            finally:
                db.close()
        except Exception as e:
            return jsonify({"status": "error", "message": f"Error processing webhook: {str(e)}"})
    
    # --- CENTERS ---
    @app.route("/centers/", methods=["POST"])
    @require_team_lead
    def create_center_endpoint(user=None):
        """Create a new center (team leads only)."""
        data = request.get_json()
        if not data:
            return jsonify({"detail": "Request body required"}), 400
        
        db = get_session_sync()
        try:
            new_center = create_center(
                db=db,
                display_name=data.get('display_name'),
                meta_tag_name=data.get('meta_tag_name'),
                city=data.get('city'),
                location=data.get('location', '')
            )
            return jsonify({
                "id": new_center.id,
                "display_name": new_center.display_name,
                "meta_tag_name": new_center.meta_tag_name,
                "city": new_center.city,
                "location": new_center.location
            })
        except ValueError as e:
            return jsonify({"detail": str(e)}), 400
        finally:
            db.close()
    
    @app.route("/centers/", methods=["GET"])
    def read_centers():
        """Get all centers."""
        db = get_session_sync()
        try:
            centers = get_all_centers(db)
            return jsonify([{
                "id": c.id,
                "display_name": c.display_name,
                "meta_tag_name": c.meta_tag_name,
                "city": c.city,
                "location": c.location
            } for c in centers])
        finally:
            db.close()
    
    return app

# Create app instance for WSGI
application = create_app()

