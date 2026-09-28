from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient


KEY_VAULT_URL = "https://food-app-secrets-dev.vault.azure.net/"
credential = DefaultAzureCredential()
secret_client = SecretClient(vault_url=KEY_VAULT_URL, credential=credential)
DB_URL = secret_client.get_secret("DatabaseUrl").value
JWT_SECRET_KEY = secret_client.get_secret("JwtSecretKey").value

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30



engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)
Base = declarative_base()

SessionLocal = sessionmaker(
    bind= engine,
    autoflush= False
)
