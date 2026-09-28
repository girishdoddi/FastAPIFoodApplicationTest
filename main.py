import uuid
from datetime import datetime, timedelta, timezone
from hashlib import md5
from pathlib import Path as FilePath
import time
from fastapi import FastAPI, Depends, status, HTTPException, Request, Response, Query, Path
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from collections import defaultdict

from jose import JWTError, jwt, ExpiredSignatureError
from sqlalchemy.orm import Session

from validation import UserCreate, UserLogin, RestaurentSignup, RestaurentAddItem, FetchRestViaPincode
from models.users import Users
from models.restaurents import Restaurent
from models.restaurent_items import RestaurentItems
from database import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    Base,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    SessionLocal,
    engine,
)
from response_models import UserLoginModel, RestaurentLoginModel

Base.metadata.create_all(bind = engine)
app = FastAPI()
app.mount("/static", StaticFiles(directory=FilePath(__file__).parent / "static"), name="static")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/login")

ips_dict = defaultdict(list)
LIMIT = 200
WINDOW = 60

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    current_time = time.time()
    ip = request.client.host
    ips_dict[ip] = [k for k in ips_dict[ip] if current_time - k < WINDOW]
    if len(ips_dict[ip]) >= LIMIT:
        retry_after = int(WINDOW - (current_time - ips_dict[ip][0]) + 1)
        return JSONResponse(
            status_code=429,
            content={"status": "TimeoutExceeded", "retry_after": retry_after},
            headers={"Retry-After": str(retry_after)},
        )
    ips_dict[ip].append(current_time)
    response = await call_next(request)
    return response



@app.get("/", include_in_schema=False)
def frontend():
    return FileResponse(FilePath(__file__).parent / "static" / "index.html")


def decode_token(token : str):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
    except ExpiredSignatureError as e:
        print(e)
        raise HTTPException(status_code= status.HTTP_403_FORBIDDEN,
                             detail= {"status" : "Token Expired, Login Again"})
    except JWTError as e:
        raise HTTPException(status_code= status.HTTP_403_FORBIDDEN,
                             detail= {"status" : "Token Tampered, Login Again"})
    print("payload-->", payload)
    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(status_code= status.HTTP_403_FORBIDDEN,
                             detail= {"status" : "User ID not present, Login Again"})
    print("Payload -->", payload)
    return payload


def create_access_token(user_id: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": user_id, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        print(e)
        db.rollback()
        raise e
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Users:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.query(Users).filter(Users.user_id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


@app.post("/user/register", status_code= status.HTTP_201_CREATED)
def register_user(request : Request,response : Response, data : UserCreate, db : Session = Depends(get_db)):
    user = db.query(Users).filter(Users.user_id == data.user_id).first()
    if user:
        response.status_code = 200
        raise HTTPException(
            detail= {"status" : "User Already exists"},
            status_code= status.HTTP_409_CONFLICT
        )
    user_obj = Users(user_id = data.user_id, phone_num = int(data.phone_num), password = md5(data.password.encode()).hexdigest(),
                     name = data.user_name, dob = data.dob, gender = data.gender, pincode = data.pincode)
    db.add(user_obj)
    return JSONResponse(
        status_code= status.HTTP_201_CREATED,
        content= {
            "status" : "User Created Successfully"
        }
    )


@app.post("/user/login", tags= ["Login"], summary="This is to logthe user In", response_model= UserLoginModel)
def login(request : Request, body : UserLogin, db : Session = Depends(get_db)):
    user_id = body.user_id
    password = body.user_password
    md5_hashed_password = md5(password.encode()).hexdigest()
    result = db.query(Users).filter(Users.user_id == user_id, Users.password == md5_hashed_password).first()
    if result:
        return {
            "access_token": create_access_token(result.user_id),
            "token_type": "bearer",
            "user_id" : user_id
        }
    raise HTTPException(detail= {
        "status" : "Invalid Credentials Please Check Username of pasword",
    }, status_code= status.HTTP_401_UNAUTHORIZED)




@app.post("/restaurent/signup", tags={"Restaurent"}, status_code=status.HTTP_201_CREATED)
def restaurnet_signup(restaurent_data: RestaurentSignup, db: Session = Depends(get_db)):
    existing_restaurant = db.query(Restaurent).filter(
        Restaurent.restaurent_phone == restaurent_data.restaurent_phone
    ).first()

    if existing_restaurant:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"status": "Restaurant already exists with this phone number"}
        )

    password = md5(restaurent_data.password.encode()).hexdigest()
    restaurent_obj = Restaurent(
        restaurent_phone=restaurent_data.restaurent_phone,
        restaurent_name=restaurent_data.restaurent_name,
        pincode=restaurent_data.pincode,
        address=restaurent_data.address,
        password=password,
        created_at=datetime.now().date(),
        city=restaurent_data.city,
    )
    db.add(restaurent_obj)
    db.commit()

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"status": "Restaurant Created Successfully"}
    )
    
@app.post("/restaurent/login", response_model=RestaurentLoginModel, tags=["Restaurents"])
def login_user(request_data : UserLogin, db : Session = Depends(get_db)):
    user_id = request_data.user_id
    password = request_data.user_password
    password = md5(password.encode()).hexdigest()
    result = db.query(Restaurent).filter(
        Restaurent.restaurent_phone == user_id,
        Restaurent.password == password,
    ).first()
    if result:
        return {
            "access_token" : create_access_token(result.restaurent_phone),
            "token_type" : "Bearer",
            "user_id" : user_id,
            "restaurent_name" : result.restaurent_name
        }
    raise HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail= {"status" : "Unauthorized"}
    )

@app.post("/restaurent/add_item", tags= ["Restaurent"], status_code= status.HTTP_201_CREATED)
def add_item(item_data : RestaurentAddItem, token : str = Depends(oauth2_scheme), db : Session = Depends(get_db)):
    payload = decode_token(token)
    restaurent_id = payload.get("sub")
    result = db.query(RestaurentItems).filter(RestaurentItems.restaurent_id == restaurent_id, RestaurentItems.item_name.ilike(item_data.item_name)).first()
    if result:
        return JSONResponse(
            status_code= status.HTTP_409_CONFLICT,
            content= {
                "status" : "Item Name already exists in DB"
            }
        )
    item_obj = RestaurentItems(item_id = uuid.uuid4(), restaurent_id = payload["sub"],
                               item_name = item_data.item_name, created_at = datetime.now(timezone.utc), modified_at = datetime.now(timezone.utc), price = item_data.price)
    db.add(item_obj)
    return {
        "status" : "Item added successfully"
    }


@app.post("/user/restaurents_by_pincode", status_code = status.HTTP_200_OK)
def get_restaurents(request : Request, input_data : FetchRestViaPincode, token = Depends(oauth2_scheme), db : Session = Depends(get_db)):
    payload = decode_token(token)
    user_id = payload.get('sub')
    pincode = input_data.pincode
    restaurents = db.query(Restaurent).filter(Restaurent.pincode == pincode).all()
    if not restaurents:
        return {
            "restaurents" : []
        }
    else:
        return [
            {
            "restaurent_phone" : r.restaurent_phone,
            "restaurent_name" : r.restaurent_name,
            }
            for r in restaurents
        ]
  

    
@app.get("/restaurent/menu/{restaurent_id}", tags= ["Restaurent"], status_code=status.HTTP_200_OK)
def get_restaurent_menu(request : Request, restaurent_id : str = Path(..., description="Needed this for fetching restaurent menu", example="9182428950"), db : Session = Depends(get_db), token = Depends(oauth2_scheme)):
    payload = decode_token(token)
    result = db.query(RestaurentItems).filter(RestaurentItems.restaurent_id == restaurent_id).all()
    return [{
        "item_name" : item.item_name,
        "item_price" : item.price
    }
    for item in result
    ]

@app.get("/restaurent/me/", tags= ["restaurents"])
def get_menu_items(request : Request, token = Depends(oauth2_scheme), db : Session = Depends(get_db)):
    payload = decode_token(token)
    res_id = payload.get("sub")
    result = db.query(RestaurentItems).filter(RestaurentItems.restaurent_id == res_id).all()
    return [
        {
            "item_name" : r.item_name,
            "item_price" : r.price
        }
        for r in result
    ]

