from django.conf import settings
from pymongo import MongoClient

def get_db():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DB_NAME]