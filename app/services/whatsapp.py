import os
import requests
import json
from dotenv import load_dotenv

# تحميل الإعدادات
load_dotenv()

GREEN_API_URL = os.getenv('GREEN_API_URL')
GREEN_API_ID_INSTANCE = os.getenv('GREEN_API_ID_INSTANCE')
GREEN_API_TOKEN_INSTANCE = os.getenv('GREEN_API_TOKEN_INSTANCE')

def format_moroccan_number(phone: str) -> str:
    '''تحويل الرقم المغربي العادي إلى صيغة GREEN-API'''
    # تنظيف الرقم من الفراغات والرموز
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    # إذا كان يبدأ بـ 0، احذفه وضع 212
    if clean_phone.startswith('0'):
        clean_phone = '212' + clean_phone[1:]
    # إذا لم يكن يبدأ بـ 212، أضفها (احتياطاً)
    elif not clean_phone.startswith('212'):
        clean_phone = '212' + clean_phone
        
    return f"{clean_phone}@c.us"

def send_whatsapp_message(phone: str, message: str) -> bool:
    '''إرسال رسالة واتساب للزبون'''
    if not GREEN_API_URL or not GREEN_API_ID_INSTANCE:
        print("⚠️ إعدادات GREEN-API غير موجودة في .env")
        return False

    api_endpoint = f"{GREEN_API_URL}/waInstance{GREEN_API_ID_INSTANCE}/sendMessage/{GREEN_API_TOKEN_INSTANCE}"
    chat_id = format_moroccan_number(phone)
    
    payload = {
        "chatId": chat_id,
        "message": message
    }
    
    try:
        response = requests.post(
            api_endpoint,
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
            timeout=10
        )
        if response.status_code == 200:
            print(f"✅ تم إرسال الواتساب بنجاح إلى {phone}")
            return True
        else:
            print(f"❌ فشل إرسال الواتساب: {response.text}")
            return False
    except Exception as e:
        print(f"❌ خطأ في الاتصال بـ WhatsApp API: {str(e)}")
        return False
