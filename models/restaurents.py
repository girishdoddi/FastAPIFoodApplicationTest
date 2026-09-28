from sqlalchemy import Column, String, Integer, Date
from database import Base

class Restaurent(Base):
    __tablename__ = "restaurents"

    restaurent_phone = Column(String(10), primary_key=True, nullable=False, unique=True)
    restaurent_name = Column(String, nullable=False)
    pincode = Column(String, nullable=False)
    address = Column(String)
    password = Column(String, nullable=False)
    created_at = Column(Date, nullable=False)
    city = Column(String(40), nullable=False)


