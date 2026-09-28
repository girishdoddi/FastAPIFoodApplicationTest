from sqlalchemy import String, Column, Integer, BigInteger, Enum, Date
from database import Base
from validation import Gender

class Users(Base):
    __tablename__ = "users"
    user_id = Column(String(30), primary_key=True)
    phone_num = Column(BigInteger, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable= False)
    dob = Column(Date, nullable=False)
    gender = Column(Enum(Gender), nullable= False)
    pincode = Column(Integer, nullable=False)


