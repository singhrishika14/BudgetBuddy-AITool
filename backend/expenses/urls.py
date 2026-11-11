from django.urls import path
from .views import (
    expense_list,
    expense_detail,
    notification_list,
    notification_read,
    expense_analytics,
)

urlpatterns = [
    path('', expense_list, name='expense-list'),
    path('<int:pk>/', expense_detail, name='expense-detail'),
    path('notifications/', notification_list, name='notification-list'),
    path('notifications/<int:pk>/read/', notification_read, name='notification-read'),
    path('analytics/', expense_analytics, name='expense-analytics'),
]
