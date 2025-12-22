from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class UserCenterLink(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    center_id: Optional[int] = Field(default=None, foreign_key="center.id", primary_key=True)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: str
    role: str = Field(default="team_member") 

    centers: List["Center"] = Relationship(back_populates="users", link_model=UserCenterLink)
    comments: List["Comment"] = Relationship(back_populates="user")

class Center(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    display_name: str
    meta_tag_name: str = Field(unique=True, index=True)
    city: str
    location: str

    users: List[User] = Relationship(back_populates="centers", link_model=UserCenterLink)
    leads: List["Lead"] = Relationship(back_populates="center")

class Lead(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_time: datetime
    player_name: str
    player_age_category: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    status: str = Field(default="New") 
    next_followup_date: Optional[datetime] = None
    
    center_id: Optional[int] = Field(default=None, foreign_key="center.id")
    center: Optional[Center] = Relationship(back_populates="leads")
    comments: List["Comment"] = Relationship(back_populates="lead")

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: int = Field(foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="comments")
    lead_id: int = Field(foreign_key="lead.id")
    lead: Optional[Lead] = Relationship(back_populates="comments")