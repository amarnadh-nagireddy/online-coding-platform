from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from mcq_contest.settings import DB
from bson.objectid import ObjectId

class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token['user_id']
            user_data = DB.users.find_one({'_id': ObjectId(user_id)})
            if not user_data:
                raise AuthenticationFailed('No such user exists')

            class TokenUser:
                def __init__(self, user_id, username, role):
                    self.user_id = user_id
                    self.username = username
                    self.role = role
                    self._is_authenticated = True

                @property
                def is_authenticated(self):
                    return self._is_authenticated

                @is_authenticated.setter
                def is_authenticated(self, value):
                    self._is_authenticated = value

                @property
                def is_active(self):
                    return True

                @property
                def is_anonymous(self):
                    return False

            return TokenUser(user_id, user_data['username'], user_data['role'])
        except Exception as e:
            raise AuthenticationFailed(f'Invalid token: {str(e)}')