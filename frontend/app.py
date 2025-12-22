import streamlit as st
import requests
import pandas as pd
from datetime import datetime
import os
from pathlib import Path

# CONFIG
API_URL = "http://127.0.0.1:8000"
ASSETS_DIR = Path(__file__).parent / "assets"

# Custom CSS for better UI
def load_custom_css():
    st.markdown("""
    <style>
        /* Main styling */
        .main {
            padding: 2rem;
        }
        
        /* Header styling */
        .header-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            color: white;
        }
        
        /* Card styling */
        .metric-card {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }
        
        /* Button styling */
        .stButton > button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.5rem 2rem;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .stButton > button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        /* Sidebar styling */
        .css-1d391kg {
            background-color: #f8f9fa;
        }
        
        /* Status badges */
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
        }
        
        .status-new { background: #e3f2fd; color: #1976d2; }
        .status-called { background: #fff3e0; color: #f57c00; }
        .status-trial { background: #e8f5e9; color: #388e3c; }
        .status-joined { background: #c8e6c9; color: #2e7d32; }
        .status-dead { background: #ffebee; color: #c62828; }
        
        /* Logo container */
        .logo-container {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .logo-container img {
            max-width: 200px;
            height: auto;
        }
        
        /* Hide Streamlit menu and footer, but keep header with sidebar toggle */
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        
        /* Keep the header visible so sidebar toggle button is accessible */
        header[data-testid="stHeader"] {
            visibility: visible !important;
            z-index: 999;
        }
        
        /* Ensure sidebar toggle button is always visible and accessible */
        button[kind="header"],
        [data-testid="stSidebarCollapseButton"],
        [data-testid="stSidebarToggleButton"],
        button[title*="sidebar"],
        button[title*="Sidebar"] {
            visibility: visible !important;
            display: block !important;
            z-index: 1000 !important;
            position: relative !important;
        }
        
        /* Make sure the toggle button is clickable */
        header button {
            pointer-events: auto !important;
        }
        
        /* Custom info boxes */
        .info-box {
            background: #e3f2fd;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #2196f3;
            margin: 1rem 0;
        }
    </style>
    """, unsafe_allow_html=True)

# Load logo if available
def load_logo():
    logo_path = ASSETS_DIR / "logo.png"
    if logo_path.exists():
        return logo_path
    # Try other common formats
    for ext in [".jpg", ".jpeg", ".svg", ".webp"]:
        alt_path = ASSETS_DIR / f"logo{ext}"
        if alt_path.exists():
            return alt_path
    return None

# Initialize page config
st.set_page_config(
    page_title="TOFA Academy CRM",
    page_icon="⚽",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load custom CSS
load_custom_css()

def login():
    # Logo at top
    logo = load_logo()
    if logo:
        st.markdown('<div class="logo-container">', unsafe_allow_html=True)
        st.image(str(logo), use_container_width=False)
        st.markdown('</div>', unsafe_allow_html=True)
    
    # Centered login form
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown('<div class="header-container">', unsafe_allow_html=True)
        st.markdown("<h1 style='text-align: center; color: white;'>⚽ TOFA Academy CRM</h1>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; color: white; opacity: 0.9;'>Welcome back! Please sign in to continue.</p>", unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        
        with st.container():
            st.markdown("<br>", unsafe_allow_html=True)
            with st.form("login_form"):
                email = st.text_input("📧 Email", placeholder="Enter your email")
                password = st.text_input("🔒 Password", type="password", placeholder="Enter your password")
                submitted = st.form_submit_button("🚀 Login", use_container_width=True)
                
                if submitted:
                    try:
                        res = requests.post(f"{API_URL}/token", data={"username": email, "password": password})
                        if res.status_code == 200:
                            data = res.json()
                            st.session_state['token'] = data['access_token']
                            st.session_state['role'] = data['role']
                            st.session_state['user_email'] = email
                            st.success("✅ Login Successful!")
                            st.rerun()
                        else:
                            st.error("❌ Invalid credentials. Please try again.")
                    except Exception as e:
                        st.error(f"⚠️ Backend connection failed: {e}")

def get_status_badge(status):
    status_map = {
        "New": ("status-new", "🆕"),
        "Called": ("status-called", "📞"),
        "Trial Scheduled": ("status-trial", "📅"),
        "Joined": ("status-joined", "✅"),
        "Dead/Not Interested": ("status-dead", "❌")
    }
    css_class, icon = status_map.get(status, ("", "•"))
    return f'<span class="status-badge {css_class}">{icon} {status}</span>'

def authenticated_app():
    # Add JavaScript to toggle sidebar (backup method)
    st.markdown("""
    <script>
        function toggleSidebar() {
            const sidebar = document.querySelector('[data-testid="stSidebar"]');
            const toggleButton = document.querySelector('[data-testid="stSidebarCollapseButton"]');
            if (sidebar) {
                if (sidebar.style.display === 'none' || sidebar.offsetParent === null) {
                    sidebar.style.display = 'block';
                    if (toggleButton) toggleButton.click();
                } else {
                    if (toggleButton) toggleButton.click();
                }
            }
        }
    </script>
    """, unsafe_allow_html=True)
    
    # Sidebar with logo and user info
    logo = load_logo()
    if logo:
        st.sidebar.image(str(logo), use_container_width=True)
    
    st.sidebar.markdown("---")
    st.sidebar.markdown(f"### 👤 {st.session_state['user_email']}")
    st.sidebar.markdown(f"**Role:** {st.session_state['role'].replace('_', ' ').title()}")
    st.sidebar.markdown("---")
    
    # Add a note about sidebar toggle
    st.sidebar.markdown("💡 **Tip:** Click the ☰ button at the top-left to collapse/expand the sidebar")
    
    # Navigation menu with icons
    menu_options = [
        ("🏠 Dashboard", "Dashboard"),
        ("👥 My Leads", "My Leads")
    ]
    
    if st.session_state['role'] == 'team_lead':
        menu_options.extend([
            ("🏢 Manage Centers", "Manage Centers"),
            ("👤 Manage Users", "Manage Users"),
            ("📊 Import Data", "Import Data")
        ])
    
    choice = st.sidebar.radio("Navigation", [opt[0] for opt in menu_options])
    choice_key = next(opt[1] for opt in menu_options if opt[0] == choice)
    
    headers = {"Authorization": f"Bearer {st.session_state['token']}"}

    if choice_key == "Dashboard":
        st.header("📊 Academy Overview")
        
        # Fetch leads for metrics
        try:
            leads_res = requests.get(f"{API_URL}/leads/my_leads", headers=headers)
            if leads_res.status_code == 200:
                leads = leads_res.json()
                df = pd.DataFrame(leads) if leads else pd.DataFrame()
                
                if not df.empty:
                    # Metrics cards
                    col1, col2, col3, col4 = st.columns(4)
                    
                    with col1:
                        st.metric("Total Leads", len(df))
                    
                    with col2:
                        new_leads = len(df[df['status'] == 'New'])
                        st.metric("New Leads", new_leads, delta=f"{new_leads} pending")
                    
                    with col3:
                        trial_scheduled = len(df[df['status'] == 'Trial Scheduled'])
                        st.metric("Trials Scheduled", trial_scheduled)
                    
                    with col4:
                        joined = len(df[df['status'] == 'Joined'])
                        st.metric("Joined", joined)
                    
                    st.markdown("---")
                    
                    # Status distribution
                    st.subheader("📈 Lead Status Distribution")
                    status_counts = df['status'].value_counts()
                    st.bar_chart(status_counts)
                    
                    # Recent activity
                    st.subheader("🕒 Recent Leads")
                    recent_leads = df.nlargest(5, 'created_time')[['player_name', 'status', 'created_time']]
                    st.dataframe(recent_leads, use_container_width=True)
                else:
                    st.info("📭 No leads found. Start by importing data!")
            else:
                st.warning("Could not fetch leads data.")
        except Exception as e:
            st.error(f"Error loading dashboard: {e}")
        
        st.markdown("---")
        st.info("💡 **Tip:** Use the sidebar to navigate to different sections of the CRM.")

    elif choice_key == "Manage Users":
        st.header("👤 Manage Team Members")
        
        # Fetch Centers for Assignment
        centers_res = requests.get(f"{API_URL}/centers/", headers=headers)
        if centers_res.status_code == 200:
            centers_data = centers_res.json()
            center_map = {c['display_name']: c['id'] for c in centers_data}
        else:
            center_map = {}
            st.error("Could not load centers.")

        with st.expander("➕ Create New User", expanded=True):
            with st.form("create_user"):
                col1, col2 = st.columns(2)
                with col1:
                    new_email = st.text_input("📧 Email *")
                    new_name = st.text_input("👤 Full Name *")
                with col2:
                    new_pass = st.text_input("🔒 Password *", type="password")
                    new_role = st.selectbox("🎭 Role *", ["team_member", "team_lead", "observer"])
                
                selected_center_names = st.multiselect("🏢 Assign Centers", list(center_map.keys()))
                
                submitted = st.form_submit_button("✨ Create User", use_container_width=True)
                if submitted:
                    if not all([new_email, new_pass, new_name]):
                        st.error("Please fill all required fields (*)")
                    else:
                        selected_ids = [center_map[name] for name in selected_center_names]
                        payload = {
                            "email": new_email,
                            "password": new_pass,
                            "full_name": new_name,
                            "role": new_role,
                            "center_ids": selected_ids
                        }
                        res = requests.post(f"{API_URL}/users/", json=payload, headers=headers)
                        if res.status_code == 200:
                            st.success(f"✅ User {new_name} created successfully!")
                            st.rerun()
                        else:
                            st.error(f"❌ Error: {res.text}")

        st.subheader("📋 Existing Users")
        users_res = requests.get(f"{API_URL}/users/", headers=headers)
        if users_res.status_code == 200:
            users_df = pd.DataFrame(users_res.json())
            if not users_df.empty:
                # Hide sensitive columns
                display_cols = ['id', 'email', 'full_name', 'role']
                st.dataframe(users_df[display_cols], use_container_width=True, hide_index=True)
            else:
                st.info("No users found.")
        else:
            st.error("Could not fetch users.")

    elif choice_key == "Manage Centers":
        st.header("🏢 Manage Centers")
        
        with st.expander("➕ Add New Center", expanded=True):
            with st.form("new_center"):
                col1, col2 = st.columns(2)
                with col1:
                    d_name = st.text_input("Display Name *", placeholder="e.g. TOFA Tellapur")
                    city = st.text_input("City *")
                with col2:
                    m_tag = st.text_input("Meta Tag *", placeholder="Copy EXACTLY from Excel")
                    loc = st.text_input("Location")
                
                submitted = st.form_submit_button("✨ Create Center", use_container_width=True)
                if submitted:
                    if not all([d_name, m_tag, city]):
                        st.error("Please fill all required fields (*)")
                    else:
                        payload = {"display_name": d_name, "meta_tag_name": m_tag, "city": city, "location": loc}
                        res = requests.post(f"{API_URL}/centers/", json=payload, headers=headers)
                        if res.status_code == 200:
                            st.success("✅ Center Created Successfully!")
                            st.rerun()
                        else:
                            st.error(f"❌ Error: {res.text}")

        st.subheader("📋 Existing Centers")
        try:
            centers = requests.get(f"{API_URL}/centers/", headers=headers).json()
            if centers:
                centers_df = pd.DataFrame(centers)
                st.dataframe(centers_df, use_container_width=True, hide_index=True)
            else:
                st.info("No centers found. Create your first center above!")
        except:
            st.error("Could not fetch centers.")

    elif choice_key == "Import Data":
        st.header("📊 Import Leads from Excel/CSV")
        st.info("💡 Upload an Excel (.xlsx, .xls) or CSV (.csv) file with lead data. Make sure the file contains the required columns.")
        
        uploaded_file = st.file_uploader(
            "Choose File", 
            type=['xlsx', 'xls', 'csv'], 
            help="Upload Excel (.xlsx, .xls) or CSV (.csv) file"
        )
        
        if uploaded_file:
            st.success(f"✅ File loaded: {uploaded_file.name}")
            if st.button("🚀 Process Import", use_container_width=True):
                with st.spinner("Processing import..."):
                    res = requests.post(f"{API_URL}/leads/upload/", files={"file": uploaded_file}, headers=headers)
                    data = res.json()
                    
                    if data.get("status") == "error":
                        st.error(f"❌ {data.get('message', 'Unknown error')}")
                        if 'unknown_tags' in data:
                            st.warning("⚠️ Please add these centers in 'Manage Centers' tab first:")
                            st.code('\n'.join(data['unknown_tags']))
                    elif data.get("status") == "success":
                        leads_added = data.get('leads_added', 0)
                        st.success(f"🎉 Successfully added {leads_added} leads!")
                        st.balloons()
                    else:
                        st.warning(f"⚠️ Unexpected response: {data}")

    elif choice_key == "My Leads":
        st.header("👥 Lead Management")
        
        leads_res = requests.get(f"{API_URL}/leads/my_leads", headers=headers)
        if leads_res.status_code == 200:
            leads = leads_res.json()
            
            if not leads:
                st.warning("📭 No leads found.")
            else:
                df = pd.DataFrame(leads)
                
                # Filters
                col1, col2 = st.columns([2, 1])
                with col1:
                    status_filter = st.multiselect(
                        "🔍 Filter by Status",
                        df['status'].unique(),
                        default=df['status'].unique()
                    )
                with col2:
                    search_term = st.text_input("🔎 Search by Name", placeholder="Type to search...")
                
                df_filtered = df[df['status'].isin(status_filter)]
                
                if search_term:
                    df_filtered = df_filtered[df_filtered['player_name'].str.contains(search_term, case=False, na=False)]
                
                # Display leads table
                if not df_filtered.empty:
                    display_df = df_filtered[['player_name', 'phone', 'status', 'next_followup_date', 'player_age_category']].copy()
                    display_df['status'] = display_df['status'].apply(lambda x: get_status_badge(x))
                    st.markdown(display_df.to_html(escape=False), unsafe_allow_html=True)
                    st.markdown("<br>", unsafe_allow_html=True)
                else:
                    st.info("No leads match your filters.")
                
                st.divider()
                
                # Update Lead Section
                st.subheader("✏️ Update Lead")
                lead_options = df_filtered.to_dict('records')
                
                if lead_options:
                    selected_lead = st.selectbox(
                        "Select Lead to Update",
                        lead_options,
                        format_func=lambda x: f"{x['player_name']} - {x['phone']} ({x['status']})"
                    )
                    
                    if selected_lead:
                        col1, col2 = st.columns(2)
                        with col1:
                            st.markdown(f"**👤 Name:** {selected_lead['player_name']}")
                            st.markdown(f"**📞 Phone:** {selected_lead['phone']}")
                        with col2:
                            st.markdown(f"**🏢 Center ID:** {selected_lead['center_id']}")
                            st.markdown(f"**📅 Age Category:** {selected_lead.get('player_age_category', 'N/A')}")
                        
                        with st.form("update_form"):
                            col1, col2 = st.columns(2)
                            with col1:
                                new_status = st.selectbox(
                                    "New Status *",
                                    ["New", "Called", "Trial Scheduled", "Joined", "Dead/Not Interested"],
                                    index=0
                                )
                            with col2:
                                next_followup = st.date_input("Next Follow Up Date")
                            
                            comment = st.text_area("📝 Add Call Notes", placeholder="Enter notes from your call...")
                            
                            if st.form_submit_button("💾 Update Status", use_container_width=True):
                                payload = {
                                    "status": new_status,
                                    "next_date": next_followup.isoformat() if next_followup else None,
                                    "comment": comment if comment else None
                                }
                                res = requests.put(f"{API_URL}/leads/{selected_lead['id']}", params=payload, headers=headers)
                                if res.status_code == 200:
                                    st.success("✅ Lead Updated Successfully!")
                                    st.rerun()
                                else:
                                    st.error("❌ Failed to update lead")
                else:
                    st.info("No leads available to update.")

    # Logout button
    st.sidebar.markdown("---")
    if st.sidebar.button("🚪 Logout", use_container_width=True):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()

if 'token' not in st.session_state:
    login()
else:
    authenticated_app()
