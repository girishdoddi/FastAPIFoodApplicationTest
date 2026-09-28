from pydantic import BaseModel, Field
from datetime import date
from enum import Enum


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class UserCreate(BaseModel):
    user_id : str
    phone_num : str = Field(pattern=r"^[6-9]\d{9}$")
    password : str
    user_name : str = Field(min_length=3, max_length=20)
    dob : date
    gender : Gender
    pincode : str = Field(pattern=r"^[1-9]\d{5}$")

class UserLogin(BaseModel):
    user_id : str
    user_password : str


class RestaurentSignup(BaseModel):
    restaurent_name : str = Field(min_length= 1, max_length= 30)
    restaurent_phone : str = Field(pattern=r"^[6-9]\d{9}$")
    password : str
    pincode : str = Field(pattern= r"^[1-9]\d{5}")
    city : str
    address : str = Field(max_length= 200)

class RestaurentAddItem(BaseModel):
    item_name : str
    price : int = Field(ge= 1, lt= 500)

class FetchRestViaPincode(BaseModel):
    pincode : str = Field(pattern= r"^[1-9]\d{5}")