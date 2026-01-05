"""
Import validation and preview functionality.
Framework-agnostic validation utilities for lead imports.
"""
import re
from typing import List, Dict, Optional, Tuple
import pandas as pd
from datetime import datetime
from backend.models import Center

def calculate_age_category(dob_val) -> str:
    """
    Convert a Date of Birth (from Meta Ads CSV) into a U-Category.
    """
    if pd.isna(dob_val) or str(dob_val).strip() == "":
        return "Unknown"
    
    try:
        # Attempt to parse the date (Meta usually uses YYYY-MM-DD)
        dob = pd.to_datetime(dob_val)
        today = datetime.now()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        if age < 7: return "U7"
        elif age < 9: return "U9"
        elif age < 11: return "U11"
        elif age < 13: return "U13"
        elif age < 15: return "U15"
        elif age < 17: return "U17"
        else: return "Senior"
    except Exception:
        return "Unknown"

def validate_lead_row(
    row: pd.Series,
    column_mapping: Dict[str, str],
    known_centers: List[Center],
    row_index: int
) -> Tuple[bool, List[str]]:
    """
    Validate a single row of lead data.
    """
    errors = []
    
    # Map user columns to system columns
    player_name_col = column_mapping.get('player_name')
    phone_col = column_mapping.get('phone')
    center_col = column_mapping.get('center')
    email_col = column_mapping.get('email')
    
    # 1. Validate Player Name
    if not player_name_col or pd.isna(row.get(player_name_col)):
        errors.append(f"Row {row_index + 1}: Player name is missing")
    elif str(row.get(player_name_col)).strip() == '':
        errors.append(f"Row {row_index + 1}: Player name is empty")
    
    # 2. Validate Phone
    if not phone_col or pd.isna(row.get(phone_col)):
        errors.append(f"Row {row_index + 1}: Phone number is missing")
    else:
        phone_val = str(row.get(phone_col)).strip()
        # Remove common phone artifacts like .0 if read as float
        if phone_val.endswith('.0'):
            phone_val = phone_val[:-2]
        if len(re.sub(r'\D', '', phone_val)) < 10:
            errors.append(f"Row {row_index + 1}: Phone must be at least 10 digits")
    
    # 3. Validate Center
    if not center_col or pd.isna(row.get(center_col)):
        errors.append(f"Row {row_index + 1}: Center selection is missing")
    else:
        center_val = str(row.get(center_col)).strip().lower()
        known_tags = [c.meta_tag_name.strip().lower() for c in known_centers]
        if center_val not in known_tags:
            errors.append(f"Row {row_index + 1}: Unknown center '{center_val}'")
    
    # 4. Validate Email (Optional)
    if email_col and not pd.isna(row.get(email_col)):
        email_val = str(row.get(email_col)).strip()
        if email_val and '@' not in email_val:
            errors.append(f"Row {row_index + 1}: Invalid email format")
    
    return len(errors) == 0, errors

def preview_import_data(
    df: pd.DataFrame,
    column_mapping: Dict[str, str],
    known_centers: List[Center]
) -> Dict:
    """
    Preview and validate import data without saving.
    """
    valid_rows = []
    invalid_rows = []
    total_errors = 0
    
    for idx, row in df.iterrows():
        is_valid, errors = validate_lead_row(row, column_mapping, known_centers, idx)
        
        # Prepare data for frontend preview
        display_data = {}
        for system_col, user_col in column_mapping.items():
            raw_val = row.get(user_col)
            
            # If the system wants an age category but we have a DOB column, calculate it
            if system_col == 'player_age_category' and user_col:
                display_data[system_col] = calculate_age_category(raw_val)
            else:
                display_data[system_col] = str(raw_val) if pd.notna(raw_val) else ""

        row_data = {
            'row_index': int(idx),
            'data': display_data,
            'errors': errors
        }
        
        if is_valid:
            valid_rows.append(row_data)
        else:
            invalid_rows.append(row_data)
            total_errors += len(errors)
    
    return {
        'total_rows': len(df),
        'valid_rows': len(valid_rows),
        'invalid_rows': len(invalid_rows),
        'total_errors': total_errors,
        'preview_data': {
            'valid': valid_rows[:50],  # Show up to 50 rows in preview
            'invalid': invalid_rows
        },
        'summary': {
            'valid_count': len(valid_rows),
            'invalid_count': len(invalid_rows),
            'error_count': total_errors
        }
    }

def auto_detect_column_mapping(df: pd.DataFrame) -> Dict[str, str]:
    """
    Automatically detect column mapping, handling Meta Ads specific symbols and questions.
    """
    mapping = {}
    csv_cols = df.columns.tolist()

    # Define patterns based on your specific Meta Ads CSV structure
    patterns = {
        'player_name': [r'player_name', r'player name'r' _player_name'],
        'phone': [r'contact_number', r'phone', r'mobile', r'contact'],
        'email': [r'email'],
        'center': [r'nearest_tofa_center', r'center', r'which_is_the_nearest'],
        'player_age_category': [r'player_date_of_birth', r'dob', r'age', r'category'],
        'address_and_pincode': [r'address_&_pincode', r'address', r'pincode']
    }

    def clean_header(header: str) -> str:
        # Removes characters like ,  and extra spaces
        cleaned = re.sub(r'[^\w\s\?]', '', header)
        return cleaned.lower().strip()

    for system_key, keywords in patterns.items():
        for col in csv_cols:
            cleaned_col = clean_header(col)
            # Check if any keyword appears in the cleaned column header
            if any(re.search(kw, cleaned_col) for kw in keywords):
                mapping[system_key] = col
                break
                
    return mapping