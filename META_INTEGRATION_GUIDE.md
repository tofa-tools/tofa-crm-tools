# 🔗 Meta (Facebook) Integration Guide

## Overview

This guide explains how to connect Meta (Facebook) data points directly to your TOFA CRM application, eliminating the need for manual Excel/CSV uploads.

---

## 🎯 Integration Options

### Option 1: Meta Conversions API (Recommended)
**Best for:** Real-time lead capture from Facebook/Instagram ads

### Option 2: Webhook Integration
**Best for:** Automated data sync from Meta Lead Forms

### Option 3: Meta Graph API
**Best for:** Custom integrations and advanced use cases

---

## 📋 Option 1: Meta Conversions API

### What It Does:
- Automatically captures leads when users submit forms on Facebook/Instagram
- Real-time data sync (no manual uploads needed)
- Tracks conversions and events

### Implementation Steps:

#### 1. **Set Up Meta Business Account**
- Go to [Meta Business Manager](https://business.facebook.com)
- Create a Business Account (if you don't have one)
- Note your **Pixel ID** and **Access Token**

#### 2. **Add Endpoint to Your Backend**

Add this to `backend/main.py`:

```python
from fastapi import HTTPException
import hashlib
import hmac
import json

# Meta Conversions API endpoint
@app.post("/leads/meta-webhook/")
async def receive_meta_lead(
    request: dict,
    db: Session = Depends(get_session)
):
    """
    Receives leads from Meta Conversions API
    """
    # Verify webhook signature (security)
    # signature = request.headers.get("X-Hub-Signature-256")
    # verify_signature(signature, request.body)
    
    try:
        # Extract lead data from Meta webhook
        entry = request.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        
        # Extract lead information
        lead_data = value.get("leadgen", {})
        
        # Map Meta fields to your Lead model
        form_data = lead_data.get("field_data", [])
        lead_dict = {item["name"]: item["values"][0] for item in form_data}
        
        # Find center from meta tag
        center_meta_tag = lead_dict.get("_which_is_the_nearest_tofa_center_to_you?", "")
        center = db.exec(select(Center).where(Center.meta_tag_name == center_meta_tag)).first()
        
        if not center:
            return {"status": "error", "message": f"Unknown center: {center_meta_tag}"}
        
        # Create new lead
        phone = lead_dict.get("phone_number", "")
        existing_lead = db.exec(select(Lead).where(Lead.phone == phone)).first()
        
        if existing_lead:
            return {"status": "duplicate", "message": "Lead already exists"}
        
        new_lead = Lead(
            created_time=datetime.now(),
            player_name=lead_dict.get("full_name", "Unknown"),
            player_age_category=lead_dict.get("player_age_category", "Unknown"),
            phone=phone,
            email=lead_dict.get("email", ""),
            address=lead_dict.get("address_and_pincode", ""),
            center_id=center.id,
            status="New"
        )
        
        db.add(new_lead)
        db.commit()
        
        return {"status": "success", "lead_id": new_lead.id}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing Meta lead: {str(e)}")
```

#### 3. **Configure Meta Lead Form**
1. Go to Meta Ads Manager
2. Create a Lead Form
3. Add webhook URL: `https://your-domain.com/leads/meta-webhook/`
4. Map form fields to match your database columns

#### 4. **Test the Integration**
- Create a test lead form submission
- Check your database for the new lead
- Verify all fields are mapped correctly

---

## 📋 Option 2: Webhook Integration (Simpler)

### What It Does:
- Receives leads via HTTP POST from Meta
- Simpler setup than Conversions API
- Good for basic lead capture

### Implementation:

#### 1. **Add Webhook Endpoint**

```python
@app.post("/leads/meta-webhook/")
async def meta_webhook(
    data: dict,
    db: Session = Depends(get_session)
):
    """
    Simple webhook endpoint for Meta Lead Forms
    """
    try:
        # Extract data (adjust based on Meta's webhook format)
        phone = data.get("phone", "")
        name = data.get("name", "Unknown")
        email = data.get("email", "")
        center_tag = data.get("nearest_center", "")
        
        # Find center
        center = db.exec(select(Center).where(Center.meta_tag_name == center_tag)).first()
        if not center:
            return {"status": "error", "message": "Center not found"}
        
        # Check for duplicates
        existing = db.exec(select(Lead).where(Lead.phone == phone)).first()
        if existing:
            return {"status": "duplicate"}
        
        # Create lead
        new_lead = Lead(
            created_time=datetime.now(),
            player_name=name,
            phone=phone,
            email=email,
            center_id=center.id,
            status="New"
        )
        db.add(new_lead)
        db.commit()
        
        return {"status": "success", "lead_id": new_lead.id}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

#### 2. **Configure in Meta**
- Go to Lead Form settings
- Add webhook URL
- Test with sample data

---

## 📋 Option 3: Meta Graph API (Advanced)

### What It Does:
- Direct API access to Meta data
- Pull leads programmatically
- More control and customization

### Implementation:

#### 1. **Install Required Package**
```bash
pip install facebook-sdk
```

#### 2. **Add Graph API Endpoint**

```python
import facebook

@app.post("/leads/sync-from-meta/")
async def sync_meta_leads(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Syncs leads from Meta using Graph API
    """
    if current_user.role != "team_lead":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Initialize Graph API
    graph = facebook.GraphAPI(access_token="YOUR_ACCESS_TOKEN")
    
    # Get lead forms
    forms = graph.get_object("me/leadgen_forms")
    
    leads_added = 0
    for form in forms["data"]:
        # Get leads from this form
        leads = graph.get_object(f"{form['id']}/leads")
        
        for lead in leads["data"]:
            # Process each lead
            # ... (similar to webhook processing)
            leads_added += 1
    
    return {"status": "success", "leads_synced": leads_added}
```

---

## 🔒 Security Considerations

### 1. **Verify Webhook Signatures**
```python
import hmac
import hashlib

def verify_meta_signature(payload, signature, secret):
    """Verify Meta webhook signature"""
    expected_signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected_signature}", signature)
```

### 2. **Use Environment Variables**
```python
import os

META_APP_SECRET = os.getenv("META_APP_SECRET")
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
```

### 3. **Rate Limiting**
Add rate limiting to prevent abuse:
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/leads/meta-webhook/")
@limiter.limit("100/hour")
async def receive_meta_lead(...):
    ...
```

---

## 🚀 Quick Start: Simple Webhook

### Step 1: Add Endpoint (Copy this to `backend/main.py`)

```python
@app.post("/leads/meta-webhook/")
async def meta_webhook_simple(
    request: Request,
    db: Session = Depends(get_session)
):
    """Simple webhook for Meta Lead Forms"""
    try:
        data = await request.json()
        
        # Extract fields (adjust based on your Meta form)
        phone = data.get("phone_number", "")
        name = data.get("full_name", "Unknown")
        email = data.get("email_address", "")
        center_tag = data.get("nearest_center", "")
        
        # Find center
        center = db.exec(
            select(Center).where(Center.meta_tag_name == center_tag)
        ).first()
        
        if not center:
            return {"status": "error", "message": f"Center '{center_tag}' not found"}
        
        # Check duplicate
        if db.exec(select(Lead).where(Lead.phone == phone)).first():
            return {"status": "duplicate"}
        
        # Create lead
        new_lead = Lead(
            created_time=datetime.now(),
            player_name=name,
            phone=phone,
            email=email,
            center_id=center.id,
            status="New"
        )
        db.add(new_lead)
        db.commit()
        
        return {"status": "success", "lead_id": new_lead.id}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

### Step 2: Deploy Your Backend
- Deploy to a server with public URL (e.g., Heroku, AWS, Railway)
- Get your webhook URL: `https://your-domain.com/leads/meta-webhook/`

### Step 3: Configure Meta
1. Go to Meta Ads Manager → Lead Forms
2. Add webhook URL
3. Map form fields
4. Test with a sample submission

---

## 📊 Testing Your Integration

### Test Webhook Locally (using ngrok):

```bash
# Install ngrok
# Then run:
ngrok http 8000

# Use the ngrok URL in Meta webhook settings
# Example: https://abc123.ngrok.io/leads/meta-webhook/
```

### Test with curl:

```bash
curl -X POST http://localhost:8000/leads/meta-webhook/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567890",
    "full_name": "Test Player",
    "email_address": "test@example.com",
    "nearest_center": "TOFA Tellapur"
  }'
```

---

## 🔄 Scheduled Sync (Alternative)

If webhooks aren't possible, sync periodically:

```python
from apscheduler.schedulers.background import BackgroundScheduler

def sync_meta_leads():
    """Runs every hour to sync leads from Meta"""
    # Your sync logic here
    pass

scheduler = BackgroundScheduler()
scheduler.add_job(sync_meta_leads, 'interval', hours=1)
scheduler.start()
```

---

## 📝 Field Mapping Reference

### Meta Form Fields → Your Database:

| Meta Field | Database Column | Notes |
|------------|----------------|-------|
| `full_name` | `player_name` | Required |
| `phone_number` | `phone` | Required, unique |
| `email_address` | `email` | Optional |
| `address_and_pincode` | `address` | Optional |
| `player_age_category` | `player_age_category` | Optional |
| `_which_is_the_nearest_tofa_center_to_you?` | `center_id` | Maps to Center table |

---

## 🎯 Next Steps

1. ✅ **Choose integration method** (Webhook is simplest)
2. ✅ **Add endpoint to backend**
3. ✅ **Deploy backend** (get public URL)
4. ✅ **Configure Meta Lead Form** (add webhook URL)
5. ✅ **Test with sample data**
6. ✅ **Monitor and verify** leads are coming through

---

## 🆘 Troubleshooting

### Leads not appearing?
- Check webhook URL is correct
- Verify center meta tags match exactly
- Check backend logs for errors
- Test webhook endpoint manually

### Duplicate leads?
- Add duplicate check (already in code)
- Use phone number as unique identifier

### Missing fields?
- Verify Meta form fields match your mapping
- Add default values for optional fields

---

## 📚 Resources

- [Meta Conversions API Docs](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Meta Webhooks Guide](https://developers.facebook.com/docs/graph-api/webhooks)
- [Meta Lead Forms](https://www.facebook.com/business/help/402791146561655)

---

**Need Help?** Check your backend logs and Meta webhook delivery status in Meta Events Manager.

