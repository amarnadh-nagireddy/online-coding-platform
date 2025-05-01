from django.urls import path
from . import views

urlpatterns = [
    path('student/dashboard/', views.student_dashboard, name='student_dashboard'),
    path('student/attempt/<int:contest_id>/', views.attempt_contest, name='attempt_contest'),
    path('student/scores/', views.student_scores, name='student_scores'),
    path('admin/dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/contest/create/', views.create_contest, name='create_contest'),
    path('admin/contest/edit/<int:contest_id>/', views.edit_contest, name='edit_contest'),
    path('admin/contest/delete/<int:contest_id>/', views.delete_contest, name='delete_contest'),
    path('admin/contest/view/<int:contest_id>/', views.view_contest, name='view_contest'),
    path('admin/contest/leaderboard/<int:contest_id>/', views.contest_leaderboard, name='contest_leaderboard'),
    path('contests/<int:contest_id>/submit', views.submit_contest, name='submit_contest'),
    path('code_execution/run', views.run_code, name='run_code'),
]