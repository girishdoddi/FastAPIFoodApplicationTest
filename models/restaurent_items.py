from database import Base
from sqlalchemy import String, Column, Integer, Enum, Date, UUID, ForeignKey

class RestaurentItems(Base):
    __tablename__ = "restaurent_items"
    item_id = Column(UUID, primary_key=True)
    restaurent_id = Column(String, ForeignKey("restaurents.restaurent_phone"), nullable=False)
    item_name = Column(String(50), nullable=False)
    created_at = Column(Date)
    modified_at = Column(Date)
    price = Column(Integer, nullable = False)
