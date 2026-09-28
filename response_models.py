from pydantic import BaseModel


class UserLoginModel(BaseModel):
    access_token: str
    token_type: str
    user_id : str


class RestaurentLoginModel(UserLoginModel):
    restaurent_name: str