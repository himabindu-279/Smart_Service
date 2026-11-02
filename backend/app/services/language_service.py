from typing import Literal

SupportedLanguage = Literal["en", "te", "hi"]

_LANGUAGE_MESSAGES = {
    "en": {
        "empty": "Tell me what is happening or what kind of service you need, and I’ll help find the right next step.",
        "clarify": "I can help with home repairs, healthcare, food, education, and vehicle services. What specific service or problem do you need help with?",
        "no_location": "Set your service location in Discover or your profile to see providers serving your area.",
        "no_providers": "No approved provider for this service was found within the service area around {area}.",
        "closest_match": "**{service}** is the closest match in {category}.",
        "service_details": "A qualified provider can assess the service request and confirm the work required.",
        "duration_price": "A typical appointment takes about {duration} minutes; the catalog starting price is ₹{price:.0f}. Final pricing may vary by provider.",
        "closest_offer": "Closest matching offer: **{provider}**, {verification}provider{rating}, {distance:.1f} km away{price}.",
    },
    "te": {
        "empty": "ఏమి జరిగింది లేదా మీకు ఏ సేవ కావాలో చెప్పండి. సరైన తదుపరి చర్యను కనుగొనడంలో నేను సహాయపడతాను.",
        "clarify": "ఇంటి మరమ్మతులు, ఆరోగ్య సంరక్షణ, ఆహారం, విద్య, వాహన సేవల గురించి నేను సహాయపడగలను. మీకు ఏ సేవ లేదా సమస్యకు సహాయం కావాలి?",
        "no_location": "మీ ప్రాంతంలోని సేవాదారులను చూడటానికి Discover లేదా ప్రొఫైల్‌లో మీ సేవా స్థానాన్ని ఎంచుకోండి.",
        "no_providers": "{area} పరిసర సేవా పరిధిలో ఈ సేవకు ఆమోదించబడిన సేవాదారు అందుబాటులో లేరు.",
        "closest_match": "{category} విభాగంలో **{service}** మీ అభ్యర్థనకు సరిపడే సేవ.",
        "service_details": "అర్హత కలిగిన సేవాదారు మీ అవసరాన్ని పరిశీలించి చేయాల్సిన పనిని నిర్ధారిస్తారు.",
        "duration_price": "సాధారణ అపాయింట్‌మెంట్‌కు సుమారు {duration} నిమిషాలు పడుతుంది; కేటలాగ్ ప్రారంభ ధర ₹{price:.0f}. సేవాదారుని బట్టి తుది ధర మారవచ్చు.",
        "closest_offer": "దగ్గరలోని సరిపడే సేవ: **{provider}**, {verification}సేవాదారు{rating}, {distance:.1f} కి.మీ దూరంలో{price}.",
    },
    "hi": {
        "empty": "बताइए क्या हुआ या आपको किस सेवा की ज़रूरत है। मैं अगला सही कदम खोजने में मदद करूँगा।",
        "clarify": "मैं घर की मरम्मत, स्वास्थ्य, भोजन, शिक्षा और वाहन सेवाओं में मदद कर सकता हूँ। आपको किस सेवा या समस्या में सहायता चाहिए?",
        "no_location": "अपने क्षेत्र में सेवा प्रदाता देखने के लिए Discover या अपनी प्रोफ़ाइल में सेवा स्थान चुनें।",
        "no_providers": "{area} के आसपास सेवा क्षेत्र में इस सेवा के लिए कोई स्वीकृत प्रदाता नहीं मिला।",
        "closest_match": "{category} में **{service}** आपकी ज़रूरत से सबसे अधिक मेल खाती सेवा है।",
        "service_details": "योग्य प्रदाता आपकी सेवा की ज़रूरत का आकलन करके आवश्यक काम की पुष्टि कर सकता है।",
        "duration_price": "आमतौर पर अपॉइंटमेंट में लगभग {duration} मिनट लगते हैं; कैटलॉग की शुरुआती कीमत ₹{price:.0f} है। प्रदाता के अनुसार अंतिम कीमत बदल सकती है।",
        "closest_offer": "सबसे नज़दीकी मिलती-जुलती सेवा: **{provider}**, {verification}प्रदाता{rating}, {distance:.1f} किमी दूर{price}।",
    },
}

_SERVICE_NAMES = {
    "ac-repair": {"te": "ఏసీ మరమ్మత్తు", "hi": "एसी मरम्मत"},
    "plumbing": {"te": "ప్లంబింగ్", "hi": "प्लंबिंग"},
    "electrical": {"te": "విద్యుత్ మరమ్మత్తు", "hi": "बिजली की मरम्मत"},
    "cleaning": {"te": "శుభ్రపరిచే సేవ", "hi": "सफाई सेवा"},
}
_CATEGORY_NAMES = {
    "Home Services": {"te": "గృహ సేవలు", "hi": "घरेलू सेवाएँ"},
    "Healthcare": {"te": "ఆరోగ్య సంరక్షణ", "hi": "स्वास्थ्य सेवा"},
    "Food Services": {"te": "ఆహార సేవలు", "hi": "खाद्य सेवाएँ"},
    "Education": {"te": "విద్య", "hi": "शिक्षा"},
    "Automotive": {"te": "వాహన సేవలు", "hi": "वाहन सेवाएँ"},
}


def detect_language(text: str, fallback: str = "en") -> SupportedLanguage:
    telugu_count = sum("\u0c00" <= char <= "\u0c7f" for char in text)
    devanagari_count = sum("\u0900" <= char <= "\u097f" for char in text)
    if telugu_count > devanagari_count and telugu_count:
        return "te"
    if devanagari_count:
        return "hi"
    if fallback in _LANGUAGE_MESSAGES:
        return fallback
    return "en"


def language_message(key: str, language: str, **values: object) -> str:
    messages = _LANGUAGE_MESSAGES.get(language, _LANGUAGE_MESSAGES["en"])
    return messages[key].format(**values)


def language_instruction(language: str) -> str:
    language_name = {"en": "English", "te": "Telugu", "hi": "Hindi"}.get(language, "English")
    return (
        f"Respond in {language_name}, matching the user's language. "
        "For mixed-language input, use the language most present in the user's message. "
        "Keep provider names, service identifiers, prices, and factual marketplace data unchanged."
    )


def catalog_label(slug: str, name: str, language: str) -> str:
    if language == "en":
        return name
    labels = _SERVICE_NAMES.get(slug, {})
    return labels.get(language, name)


def category_label(name: str, language: str) -> str:
    if language == "en":
        return name
    return _CATEGORY_NAMES.get(name, {}).get(language, name)
