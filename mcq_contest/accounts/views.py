from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import UserSerializer
from django.contrib.auth import get_user_model
from .models import User
import jwt

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests
from django.conf import settings
import uuid
import logging

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    logger.debug(f"Received request data: {request.data}")
    token = request.data.get('token')
    client_id = settings.GOOGLE_CLIENT_ID

    if not client_id:
        logger.error("Google Client ID is not configured")
        return Response({'error': 'Server configuration error: Google Client ID missing'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if not token:
        logger.warning("Token missing in request")
        return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)
        logger.debug(f"Verified token info: {idinfo}")

        # Extract user information
        email = idinfo['email']
        name = idinfo.get('name', '')
        # Generate a unique username to avoid conflicts
        base_username = email.split('@')[0]
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{uuid.uuid4().hex[:8]}"
            counter += 1
            if counter > 10:  # Prevent infinite loops
                logger.error("Failed to generate unique username")
                return Response({'error': 'Unable to generate unique username'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create the user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'first_name': name.split()[0] if name else '',
                'last_name': ' '.join(name.split()[1:]) if name and len(name.split()) > 1 else '',
                'role': request.data.get('role', 'student'),
                'is_active': True
            }
        )
        logger.info(f"User {'created' if created else 'retrieved'}: {user.username}")

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Google login successful',
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'role': user.role
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        logger.error(f"Invalid Google token: {str(e)}")
        return Response({'error': f'Invalid Google token: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        return Response({'error': f'Server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def student_register(request):
    data = request.data
    try:
        user = User.objects.create_user(
            username=data['username'],
            email=data.get('email', ''),
            password=data['password'],
            role='student'
        )
        return Response({
            'message': 'Student registered successfully',
            'user_id': str(user.id)
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def admin_register(request):
    data = request.data
    try:
        user = User.objects.create_user(
            username=data['username'],
            email=data.get('email', ''),
            password=data['password'],
            role='admin',
            is_staff=True
        )
        return Response({
            'message': 'Admin registered successfully',
            'user_id': str(user.id)
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = User.objects.filter(username=username).first()
    print(f"User: {user}, Type: {type(user)}")  # Debug log
    
    if user and user.check_password(password):
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Login successful',
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'role': user.role
        }, status=status.HTTP_200_OK)
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'Refresh token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': f'Logout failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)