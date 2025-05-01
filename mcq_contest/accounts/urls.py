from django.urls import path
from .views import *

urlpatterns = [
    path('student/register/', student_register, name='student_register'),
    path('admin/register/', admin_register, name='admin_register'),
    path('login/', login, name='login'),
    path('google-login/', google_login, name='google_login'),
    path('logout/', logout, name='logout'), 
    path('user/', get_current_user, name='get_current_user'), 
]