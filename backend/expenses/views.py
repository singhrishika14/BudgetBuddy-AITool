from django.contrib.auth.models import User
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Expense, Notification
from .serializers import ExpenseSerializer, NotificationSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def expense_list(request):
    if request.method == 'GET':
        expenses = Expense.objects.filter(user=request.user).order_by('-date', '-created_at')
        return Response(ExpenseSerializer(expenses, many=True).data)

    serializer = ExpenseSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def expense_detail(request, pk):
    try:
        expense = Expense.objects.get(pk=pk, user=request.user)
    except Expense.DoesNotExist:
        return Response({'error': 'Expense not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ExpenseSerializer(expense).data)
    if request.method in ['PUT', 'PATCH']:
        serializer = ExpenseSerializer(expense, data=request.data, partial=(request.method == 'PATCH'))
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    expense.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
def register_user(request):
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip()
    password = request.data.get('password', '')
    if not username or not email or not password:
        return Response({'error': 'Username, email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 8:
        return Response({'error': 'Password must contain at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=username, email=email, password=password)
    return Response({'message': 'Registration successful.', 'username': user.username}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    if request.method == 'GET':
        items = Notification.objects.filter(user=request.user).order_by('-created_at')
        return Response(NotificationSerializer(items, many=True).data)

    serializer = NotificationSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def notification_read(request, pk):
    try:
        item = Notification.objects.get(pk=pk, user=request.user)
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
    item.is_read = bool(request.data.get('is_read', True))
    item.save(update_fields=['is_read'])
    return Response(NotificationSerializer(item).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expense_analytics(request):
    today = timezone.localdate()
    expenses = Expense.objects.filter(user=request.user)
    month_expenses = expenses.filter(date__year=today.year, date__month=today.month)
    total = expenses.aggregate(value=Sum('amount'))['value'] or 0
    monthly_total = month_expenses.aggregate(value=Sum('amount'))['value'] or 0
    transaction_count = month_expenses.count()
    category_rows = list(
        month_expenses.values('category').annotate(total=Sum('amount'), count=Count('id')).order_by('-total')
    )
    monthly_rows = list(
        expenses.annotate(month=TruncMonth('date')).values('month').annotate(total=Sum('amount')).order_by('month')
    )
    return Response({
        'all_time_total': total,
        'monthly_total': monthly_total,
        'monthly_transaction_count': transaction_count,
        'category_breakdown': category_rows,
        'monthly_trend': [
            {'month': row['month'].strftime('%Y-%m'), 'total': row['total']}
            for row in monthly_rows
        ],
    })