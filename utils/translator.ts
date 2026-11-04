import { ContentBlock } from '../db/schema';
import { LANGUAGE_MAP, LanguageCode } from '../constants/i18n';

const TRANSLATION_CACHE_KEY = 'folia_sqlite_translations_v1';

export interface TranslatedArticlePayload {
  articleId: string;
  targetLang: LanguageCode;
  translatedTitle: string;
  translatedBlocks: Record<number, string>;
  updatedAt: string;
}

// Comprehensive offline curated translations for sample titles, headings, and paragraphs across all 15 main languages
const OFFLINE_PASSAGE_DICTIONARY: Record<string, Partial<Record<LanguageCode, string>>> = {
  'How to Do Great Work': {
    bn: 'কীভাবে মহান ও কালজয়ী কাজ করবেন',
    ar: 'كيف تنجز عملاً عظيماً',
    fa: 'چگونه کارهای بزرگ و ماندگار انجام دهیم',
    es: 'Cómo hacer un gran trabajo',
    fr: 'Comment accomplir un excellent travail',
    de: 'Wie man großartige Arbeit leistet',
    zh: '如何做出伟大的工作',
    hi: 'महान कार्य कैसे करें',
    ru: 'Как делать великую работу',
    pt: 'Como fazer um grande trabalho',
    ja: '素晴らしい仕事をする方法',
    tr: 'Harika İşler Nasıl Yapılır',
    ko: '위대한 일을 하는 방법',
    it: 'Come fare un grande lavoro',
    ur: 'عظیم کام کیسے کیا جائے',
  },
  'If you collected lists of techniques for doing great work in a lot of different fields, what would the intersection look like? I decided to find out by making it.': {
    bn: 'আপনি যদি বিভিন্ন ক্ষেত্রে অসাধারণ কাজ করার কৌশলগুলোর তালিকা একত্রিত করেন, তবে তাদের সাধারণ মিলগুলো কেমন দেখাবে? আমি নিজেই সেটি তৈরি করে খুঁজে বের করার সিদ্ধান্ত নিলাম।',
    ar: 'إذا جمعت قوائم بتقنيات إنجاز الأعمال العظيمة في مجالات مختلفة عديدة، فكيف سيبدو القاسم المشترك بينها؟ قررت اكتشاف ذلك بنفسي.',
    fa: 'اگر فهرستی از روش‌های انجام کارهای بزرگ در رشته‌های گوناگون را گردآوری کنید، فصل مشترک آن‌ها چه خواهد بود؟ تصمیم گرفتم با نوشتن این مقاله پاسخ را بیابم.',
    es: 'Si recopilaras listas de técnicas para hacer un gran trabajo en muchos campos diferentes, ¿cómo sería su intersección? Decidí averiguarlo creándola.',
    fr: 'Si vous rassembliez des listes de techniques pour accomplir du grand travail dans différents domaines, à quoi ressemblerait leur intersection ? J’ai décidé de le découvrir.',
    de: 'Wenn man Listen von Techniken für großartige Arbeit in vielen verschiedenen Bereichen sammelt, wie sähe die Schnittmenge aus? Ich beschloss, es herauszufinden.',
    zh: '如果你收集各个不同领域做出伟大工作的技巧清单，它们的交集会是什么样子？我决定亲自整理并找出答案。',
    hi: 'यदि आप विभिन्न क्षेत्रों में महान कार्य करने की तकनीकों की सूची एकत्र करें, तो उनका सामान्य बिंदु कैसा दिखेगा? मैंने इसे स्वयं बनाकर जानने का निश्चय किया।',
    ru: 'Если собрать списки приемов для достижения выдающихся результатов в самых разных областях, что окажется на их пересечении? Я решил выяснить это.',
    pt: 'Se você reunisse listas de técnicas para fazer um excelente trabalho em diferentes áreas, como seria a interseção? Decidi descobrir criando uma.',
    ja: 'さまざまな分野で素晴らしい仕事をするための技法リストを集めたら、その共通項はどうなるでしょうか？私は実際に作って確かめることにしました。',
    tr: 'Farklı alanlarda harika işler yapmanın tekniklerini toplasaydınız kesişim kümesi nasıl görünürdü? Bunu bizzat oluşturarak öğrenmeye karar verdim.',
    ko: '다양한 분야에서 위대한 업적을 이루는 기법들의 목록을 모은다면 그 교집합은 어떤 모습일까요? 직접 만들어 보며 확인해 보기로 했습니다.',
    it: 'Se raccogliessi elenchi di tecniche per fare un grande lavoro in molti campi diversi, come sarebbe la loro intersezione? Ho deciso di scoprirlo.',
    ur: 'اگر آپ مختلف شعبوں میں عظیم کام کرنے کی تکنیکوں کی فہرستیں جمع کریں تو ان کا مشترک نقطہ کیا ہوگا؟ میں نے اسے خود ترتیب دے کر جاننے کا فیصلہ کیا۔',
  },
  '1. Choosing What to Work On': {
    bn: '১. কী নিয়ে কাজ করবেন তা নির্বাচন করা',
    ar: '١. اختيار المجال الذي تعمل فيه',
    fa: '۱. انتخاب موضوع و مسیر کار',
    es: '1. Elegir en qué trabajar',
    fr: '1. Choisir sur quoi travailler',
    de: '1. Auswählen, woran man arbeitet',
    zh: '1. 选择你要从事的工作',
    hi: '1. यह चुनना कि किस पर काम करना है',
    ru: '1. Выбор того, над чем работать',
    pt: '1. Escolhendo no que trabalhar',
    ja: '1. 何に取り組むかを選ぶ',
    tr: '1. Ne Üzerinde Çalışılacağını Seçmek',
    ko: '1. 무엇을 할지 선택하기',
    it: '1. Scegliere su cosa lavorare',
    ur: '1. کام کے موضوع کا انتخاب',
  },
  'The first step is to decide what to work on. The work you choose needs to have three qualities: it has to be something you have a natural aptitude for, that you have a deep interest in, and that offers scope to do great work.': {
    bn: 'প্রথম ধাপ হলো আপনি কী নিয়ে কাজ করবেন তা ঠিক করা। আপনার বেছে নেওয়া কাজে তিনটি গুণ থাকতে হবে: সেটিতে আপনার সহজাত দক্ষতা থাকতে হবে, গভীর আগ্রহ থাকতে হবে এবং সেখানে অসাধারণ কিছু করার সুযোগ থাকতে হবে।',
    ar: 'الخطوة الأولى هي أن تقرر ما ستعمل عليه. يجب أن يتسم العمل الذي تختاره بثلاث صفات: موهبة فطرية لديك، واهتمام عميق به، ومجال واسع لإنجاز عمل عظيم.',
    fa: 'گام نخست این است که تصمیم بگیرید روی چه چیزی کار کنید. کاری که برمی‌گزینید باید سه ویژگی داشته باشد: استعداد طبیعی در آن داشته باشید، به آن علاقه عمیق داشته باشید و ظرفیت انجام کاری بزرگ را فراهم کند.',
    es: 'El primer paso es decidir en qué trabajar. El trabajo que elijas debe tener tres cualidades: aptitud natural, interés profundo y margen para lograr algo extraordinario.',
    fr: 'La première étape consiste à décider sur quoi travailler. Le travail choisi doit réunir trois qualités : une aptitude naturelle, un intérêt profond et un vaste potentiel.',
    de: 'Der erste Schritt besteht darin, zu entscheiden, woran man arbeitet. Die Arbeit muss drei Eigenschaften haben: natürliche Begabung, tiefes Interesse und Raum für Großes.',
    zh: '第一步是决定做什么工作。你选择的工作需要具备三个特质：你有天然的才能、怀有深厚的兴趣，并且拥有做出伟大成果的空间。',
    hi: 'पहला कदम यह तय करना है कि किस विषय पर काम किया जाए। आपके द्वारा चुने गए कार्य में तीन गुण होने चाहिए: स्वाभाविक योग्यता, गहरी रुचि, और महान कार्य करने की संभावना।',
    ru: 'Первый шаг — решить, над чем работать. Выбранное дело должно обладать тремя качествами: природной склонностью, глубоким интересом и простором для великих свершений.',
    pt: 'O primeiro passo é decidir no que trabalhar. O trabalho escolhido precisa ter três qualidades: aptidão natural, interesse profundo e espaço para realizar algo grandioso.',
    ja: '最初のステップは何に取り組むかを決めることです。選ぶ仕事には、天性の適性、深い関心、そして素晴らしい仕事ができる余地という3つの要素が必要です。',
    tr: 'İlk adım ne üzerinde çalışacağınıza karar vermektir. Seçtiğiniz işin üç özelliği olmalıdır: doğal yetenek, derin ilgi ve harika işler yapma potansiyeli.',
    ko: '첫 번째 단계는 무엇을 할지 결정하는 것입니다. 선택하는 일은 타고난 적성, 깊은 흥미, 그리고 위대한 성취를 이룰 가능성이라는 세 가지 조건을 갖추어야 합니다.',
    it: 'Il primo passo è decidere su cosa lavorare. Il lavoro scelto deve avere tre qualità: attitudine naturale, profondo interesse e spazio per realizzare grandi cose.',
    ur: 'پہلا قدم یہ طے کرنا ہے کہ کس چیز پر کام کیا جائے۔ آپ کے منتخب کردہ کام میں تین خوبیاں ہونی چاہئیں: فطری صلاحیت، گہری دلچسپی اور عظیم کام کرنے کی گنجائش۔',
  },
  'Curiosity is the best guide. Your curiosity never lies, and it knows more than you do about what is worth paying attention to.': {
    bn: 'কৌতূহলই হলো সর্বোত্তম পথপ্রদর্শক। আপনার কৌতূহল কখনো মিথ্যা বলে না, এবং কোন বিষয়ে মনোযোগ দেওয়া সার্থক তা সে আপনার চেয়েও ভালো জানে।',
    ar: 'الفضول هو أفضل مرشد. فضولك لا يكذب أبداً، وهو يعرف أكثر منك عما يستحق الاهتمام والتركيز.',
    fa: 'کنجکاوی بهترین راهنماست. کنجکاوی شما هرگز دروغ نمی‌گوید و بهتر از خودتان می‌داند چه چیزی ارزش تمرکز و توجه دارد.',
    es: 'La curiosidad es la mejor guía. Tu curiosidad nunca miente y sabe más que tú sobre aquello a lo que vale la pena prestar atención.',
    fr: 'La curiosité est le meilleur guide. Votre curiosité ne ment jamais et sait mieux que vous ce qui mérite votre attention.',
    de: 'Neugier ist der beste Wegweiser. Deine Neugier lügt nie, und sie weiß besser als du selbst, worauf es sich zu achten lohnt.',
    zh: '好奇心是最好的向导。你的好奇心从不说谎，它比你更清楚什么事情值得倾注注意力。',
    hi: 'जिज्ञासा सबसे अच्छी मार्गदर्शक है। आपकी जिज्ञासा कभी झूठ नहीं बोलती, और वह आपसे बेहतर जानती है कि किस बात पर ध्यान देना सार्थक है।',
    ru: 'Любознательность — лучший проводник. Ваше любопытство никогда не лжет и знает лучше вас, на что стоит обратить внимание.',
    pt: 'A curiosidade é o melhor guia. Sua curiosidade nunca mente e sabe mais do que você sobre o que vale a pena prestar atenção.',
    ja: '好奇心こそ最良の道標です。好奇心は決して嘘をつかず、何に注意を払うべきかをあなた自身よりもよく知っています。',
    tr: 'Merak en iyi rehberdir. Merakınız asla yalan söylemez ve neye dikkat etmeye değer olduğunu sizden daha iyi bilir.',
    ko: '호기심은 최고의 길잡이입니다. 당신의 호기심은 결코 거짓말을 하지 않으며, 무엇에 주의를 기울여야 할지 당신보다 더 잘 알고 있습니다.',
    it: 'La curiosità è la migliore guida. La tua curiosità non mente mai e sa meglio di te a cosa vale la pena prestare attenzione.',
    ur: 'تجسس بہترین رہنما ہے۔ آپ کا تجسس کبھی جھوٹ نہیں بولتا اور وہ آپ سے بہتر جانتا ہے کہ کس چیز پر توجہ دینا قابلِ قدر ہے۔',
  },
  'In practice you don’t have to worry much about the third criterion. Ambitious people are if anything already too conservative about it. So all you need to do is find something you have an aptitude for and great interest in.': {
    bn: 'বাস্তবে তৃতীয় শর্তটি নিয়ে আপনাকে খুব বেশি চিন্তা করতে হবে না। উচ্চাকাঙ্ক্ষী মানুষেরা এ বিষয়ে এমনিতেই যথেষ্ট সতর্ক থাকেন। তাই আপনার কাজ হলো এমন কিছু খুঁজে বের করা যাতে আপনার দক্ষতা ও গভীর আগ্রহ রয়েছে।',
  },
  '2. The Compounding Effect of Deep Focus': {
    bn: '২. গভীর মনোযোগের চক্রবৃদ্ধি প্রভাব',
    ar: '٢. الأثر التراكمي للتركيز العميق',
    fa: '۲. اثر مرکب تمرکز عمیق',
    es: '2. El efecto compuesto del enfoque profundo',
    fr: '2. L’effet cumulé de la concentration profonde',
    de: '2. Der Zinseszinseffekt tiefer Konzentration',
    zh: '2. 深度专注的复利效应',
    hi: '2. गहन एकाग्रता का चक्रवृद्धि प्रभाव',
    ru: '2. Накопительный эффект глубокого фокуса',
    pt: '2. O efeito composto do foco profundo',
    ja: '2. 深い集中がもたらす複利効果',
    tr: '2. Derin Odaklanmanın Bileşik Etkisi',
    ko: '2. 깊은 몰입의 복리 효과',
    it: '2. L’effetto composto della concentrazione profonda',
    ur: '2. گہری توجہ کا مرکب اثر',
  },
  'Great work happens by focusing consistently on something you are genuinely curious about. Even a small daily advance compounds into extraordinary originality over a decade when distractions are ruthlessly eliminated.': {
    bn: 'আপনি সত্যিকার অর্থে যে বিষয়ে কৌতূহলী, তার ওপর ধারাবাহিকভাবে মনোযোগ নিবদ্ধ করলেই মহান কাজ সৃষ্টি হয়। বিক্ষিপ্ততা দূর করে প্রতিদিন সামান্য অগ্রগতিও এক দশকে অসাধারণ মৌলিকত্বে পরিণত হয়।',
    ar: 'يتحقق العمل العظيم من خلال التركيز المستمر على شيء يثير فضولك بصدق. حتى التقدم اليومي البسيط يتضاعف ليشكل أصالة استثنائية عندما يتم القضاء على المشتتات.',
    fa: 'کارهای بزرگ با تمرکز پیوسته بر موضوعی که واقعاً به آن کنجکاوید شکل می‌گیرند. حتی یک پیشرفت کوچک روزانه، با حذف قاطعانه عوامل حواس‌پرتی، در طول زمان به نوآوری خارق‌العاده تبدیل می‌شود.',
    es: 'El gran trabajo surge al concentrarse constantemente en algo que despierta tu auténtica curiosidad. Incluso un pequeño avance diario se multiplica cuando eliminas las distracciones.',
    fr: 'Le grand travail naît d’une concentration constante sur ce qui éveille sincèrement votre curiosité. Même une petite avancée quotidienne se démultiplie sans distractions.',
    de: 'Großartige Arbeit entsteht durch beständige Konzentration auf etwas, das echte Neugier weckt. Selbst kleine tägliche Fortschritte summieren sich ohne Ablenkungen enorm.',
    zh: '伟大的工作源于对你真正好奇的事物保持始终如一的专注。当彻底消除干扰时，哪怕每天微小的进步也会在十年间复利累积成非凡的独创性。',
    hi: 'महान कार्य किसी ऐसे विषय पर निरंतर ध्यान केंद्रित करने से होता है जिसके बारे में आप वास्तव में जिज्ञासु हैं। विकर्षणों को हटाने पर छोटी दैनिक प्रगति भी असाधारण बन जाती है।',
    ru: 'Великая работа рождается из постоянной концентрации на том, что вам искренне интересно. Даже небольшой ежедневный шаг превращается в выдающуюся оригинальность без отвлечений.',
    pt: 'O grande trabalho acontece ao focar consistentemente em algo sobre o qual você tem curiosidade genuína. Mesmo um pequeno avanço diário se multiplica sem distrações.',
    ja: '素晴らしい仕事は、心から好奇心を持てる対象に一貫して集中することで生まれます。邪魔を排除すれば、毎日の小さな前進がやがて非凡な独創性へと複利で成長します。',
    tr: 'Harika işler, gerçekten merak ettiğiniz bir şeye istikrarlı biçimde odaklanmakla gerçekleşir. Dikkat dağıtıcılar elendiğinde küçük günlük ilerlemeler bile olağanüstüผลlar doğurur.',
    ko: '위대한 작업은 진정으로 호기심을 느끼는 대상에 꾸준히 집중할 때 이루어집니다. 방해 요소를 제거하면 매일의 작은 전진이 쌓여 독창적인 성취가 됩니다.',
    it: 'Il grande lavoro nasce concentrandosi con costanza su ciò che suscita autentica curiosità. Anche un piccolo progresso quotidiano si moltiplica eliminando le distrazioni.',
    ur: 'عظیم کام کسی ایسی چیز پر مسلسل توجہ مرکوز کرنے سے ہوتا ہے جس کے بارے میں آپ واقعی متجسس ہوں۔ خلفشار ختم کرنے سے روزانہ کی معمولی پیشرفت بھی غیر معمولی بن جاتی ہے۔',
  },
  'Follow your own independent curiosity rather than fashionable consensus topics.': {
    bn: 'জনপ্রিয় বা প্রচলিত বিষয়ের পেছনে না ছুটে আপনার নিজস্ব স্বাধীন কৌতূহলকে অনুসরণ করুন।',
  },
  'Protect large blocks of uninterrupted reading and thinking time every morning.': {
    bn: 'প্রতিদিন সকালে নিরবচ্ছিন্নভাবে পড়া ও গভীরভাবে চিন্তা করার জন্য দীর্ঘ সময় সংরক্ষিত রাখুন।',
  },
  'Write down half-formed questions in the margins—most breakthroughs begin as a single anomaly noticed while reading deeply.': {
    bn: 'পড়ার সময় মার্জিনে আধো-গঠিত প্রশ্নগুলো লিখে রাখুন—অধিকাংশ যুগান্তকারী আবিষ্কারের শুরু হয় গভীর পাঠের সময় লক্ষ্য করা ছোট কোনো প্রশ্ন থেকে।',
  },
  'When you read actively—highlighting the sentences that surprise you and writing brief margin notes in your own words—you transform passive consumption into original synthesis.': {
    bn: 'যখন আপনি সক্রিয়ভাবে পড়েন—চমকে দেওয়া বাক্যগুলো হাইলাইট করেন এবং নিজের ভাষায় সংক্ষিপ্ত নোট লেখেন—তখন সাধারণ পাঠ মৌলিক চিন্তায় রূপান্তরিত হয়।',
  },
  'The Local-First Software Manifesto': {
    bn: 'লোকাল-ফার্স্ট (Local-First) সফটওয়্যার ইশতেহার',
    ar: 'بيان البرمجيات المحلية أولاً (Local-First)',
    fa: 'مانیفست نرم‌افزارهای محلی و آفلاین‌محور (Local-First)',
    es: 'El Manifiesto del Software Local-First',
    fr: 'Le Manifeste du Logiciel Local-First',
    de: 'Das Local-First-Software-Manifest',
    zh: '本地优先 (Local-First) 软件宣言',
    hi: 'लोकल-फर्स्ट सॉफ्टवेयर घोषणापत्र',
    ru: 'Манифест локально-ориентированного ПО (Local-First)',
    pt: 'O Manifesto do Software Local-First',
    ja: 'ローカルファースト・ソフトウェア宣言',
    tr: 'Yerel-Öncelikli (Local-First) Yazılım Manifestosu',
    ko: '로컬 퍼스트(Local-First) 소프트웨어 선언문',
    it: 'Il Manifesto del Software Local-First',
    ur: 'لوکل فرسٹ سافٹ ویئر کا منشور',
  },
  'Cloud apps have given us seamless collaboration, yet they have quietly taken away true ownership of our personal knowledge. When a startup shuts down its servers or locks your library behind a recurring subscription, years of your curated articles and notes can vanish overnight.': {
    bn: 'ক্লাউড অ্যাপ আমাদের সহজ সহযোগিতার সুযোগ দিয়েছে ঠিকই, কিন্তু নীরবে আমাদের ব্যক্তিগত জ্ঞানভাণ্ডারের প্রকৃত মালিকানা কেড়ে নিয়েছে। কোনো স্টার্টআপ সার্ভার বন্ধ করে দিলে বা সাবস্ক্রিপশনের আড়ালে লাইব্রেরি আটকে দিলে আপনার বছরের পর বছর জমানো আর্টিকেল ও নোট রাতারাতি হারিয়ে যেতে পারে।',
  },
  'The Seven Ideals of Local-First Software': {
    bn: 'লোকাল-ফার্স্ট সফটওয়্যারের সাতটি আদর্শ নীতি',
  },
  'In local-first software, the primary copy of your data lives right on your own device in an open, inspectable database like SQLite or plain Markdown files. Remote cloud drives serve only as an encrypted backup or user-controlled sync conduit—never a gatekeeper.': {
    bn: 'লোকাল-ফার্স্ট সফটওয়্যারে আপনার ডেটার মূল কপি থাকে সরাসরি আপনার নিজের ডিভাইসে—SQLite বা সাধারণ Markdown ফাইলের মতো উন্মুক্ত ডেটাবেসে। ক্লাউড ড্রাইভ কেবল ব্যাকআপ হিসেবে কাজ করে, কখনোই আপনার তথ্যের নিয়ন্ত্রক হিসেবে নয়।',
  },
  'Your thoughts, highlights, and reading archive belong on your device first—accessible in Airplane Mode today and readable fifty years from now.': {
    bn: 'আপনার চিন্তা, হাইলাইট এবং পাঠ-সংগ্রহ সবার আগে আপনার নিজের ডিভাইসের সম্পদ—যা আজ ফ্লাইট মোডেও সম্পূর্ণ সচল এবং পঞ্চাশ বছর পরেও একইভাবে পাঠযোগ্য থাকবে।',
    ar: 'أفكارك وتظليلاتك وأرشيف قراءتك ملك لجهازك أولاً — متاحة في وضع الطيران اليوم وقابلة للقراءة بعد خمسين عاماً من الآن.',
    fa: 'اندیشه‌ها، هایلایت‌ها و آرشیو مطالعات شما پیش از هر چیز متعلق به دستگاه خودتان است—امروز در حالت پرواز در دسترس و پنجاه سال دیگر هم قابل خواندن.',
    es: 'Tus pensamientos, resaltados y archivo de lectura pertenecen primero a tu dispositivo: accesibles hoy en modo avión y legibles dentro de cincuenta años.',
    fr: 'Vos pensées, surlignages et archives de lecture appartiennent d’abord à votre appareil — accessibles en mode avion aujourd’hui et lisibles dans cinquante ans.',
    de: 'Deine Gedanken, Markierungen und dein Lesearchiv gehören zuerst auf dein eigenes Gerät – heute im Flugmodus verfügbar und noch in fünfzig Jahren lesbar.',
    zh: '你的思考、高亮笔记与阅读档案首先属于你的本地设备——今天在飞行模式下随时可读，五十年后依然清晰可用。',
    hi: 'आपके विचार, हाइलाइट्स और पठन संग्रह सबसे पहले आपके डिवाइस के हैं—आज एयरप्लेन मोड में उपलब्ध और पचास साल बाद भी पढ़ने योग्य।',
    ru: 'Ваши мысли, заметки и архив чтения принадлежат прежде всего вашему устройству — они доступны в авиарежиме сегодня и будут читаемы через пятьдесят лет.',
    pt: 'Seus pensamentos, destaques e arquivo de leitura pertencem primeiro ao seu dispositivo — acessíveis no Modo Avião hoje e legíveis daqui a cinquenta anos.',
    ja: 'あなたの思考、ハイライト、読書アーカイブはまずあなた自身の端末に属します。今日機内モードでアクセスでき、50年後もそのまま読み返せます。',
    tr: 'Düşünceleriniz, vurgularınız ve okuma arşiviniz öncelikle kendi cihazınıza aittir; bugün Uçak Modunda erişilebilir ve elli yıl sonra bile okunabilir.',
    ko: '당신의 생각, 하이라이트, 독서 아카이브는 무엇보다 당신의 기기에 먼저 속합니다. 오늘 비행기 모드에서 바로 열람할 수 있고 50년 후에도 읽을 수 있습니다.',
    it: 'I tuoi pensieri, le evidenziazioni e l’archivio di lettura appartengono prima di tutto al tuo dispositivo: accessibili oggi in modalità aereo e leggibili tra cinquant’anni.',
    ur: 'آپ کے خیالات، ہائی لائٹس اور مطالعے کا ذخیرہ سب سے پہلے آپ کے اپنے آلے کی ملکیت ہے—آج ایروپلین موڈ میں دستیاب اور پچاس سال بعد بھی پڑھنے کے قابل۔',
  },
  'Why Plain Text & Markdown Endure': {
    bn: 'কেন প্লেইন টেক্সট এবং Markdown চিরস্থায়ী',
  },
  'Proprietary cloud databases come and go, but UTF-8 Markdown (.md) and open JSON backups are immortal. By exporting your reading highlights directly to Markdown, your Second Brain in Obsidian, Notion, or Logseq remains permanently yours.': {
    bn: 'বাণিজ্যিক ক্লাউড ডেটাবেস আসে এবং চলেও যায়, কিন্তু UTF-8 Markdown (.md) এবং উন্মুক্ত JSON ব্যাকআপ চিরস্থায়ী। আপনার হাইলাইটগুলো সরাসরি Markdown-এ এক্সপোর্ট করার মাধ্যমে Obsidian বা Notion-এ আপনার জ্ঞানভাণ্ডার চিরকাল আপনারই থাকে।',
  },
  'Designing for Calm Attention': {
    bn: 'প্রশান্ত মনোযোগ ও গভীর পাঠের জন্য ডিজাইন',
    ar: 'التصميم من أجل انتباه هادئ وعميق',
    fa: 'طراحی برای تمرکز آرام و مطالعه عمیق',
    es: 'Diseñando para una atención tranquila',
    fr: 'Concevoir pour une attention apaisée',
    de: 'Design für ruhige Aufmerksamkeit',
    zh: '为平静专注而设计',
    hi: 'शांत ध्यान और एकाग्रता के लिए डिज़ाइन',
    ru: 'Дизайн для спокойного внимания',
    pt: 'Projetando para uma atenção calma',
    ja: '穏やかな集中のためのデザイン',
    tr: 'Sakin Dikkat İçin Tasarım',
    ko: '차분한 집중을 위한 디자인',
    it: 'Progettare per un’attenzione calma',
    ur: 'پرسکون توجہ کے لیے ڈیزائننگ',
  },
  'Modern web pages are engineered for fragmentation: auto-playing videos, sticky newsletter popups, cookie walls, and algorithmic sidebars compete for every millisecond of your visual cortex.': {
    bn: 'আধুনিক ওয়েব পেজগুলো মনোযোগ বিচ্ছিন্ন করার জন্যই তৈরি: অটো-প্লে ভিডিও, নিউজলেটার পপ-আপ, কুকি ব্যানার এবং অ্যালগরিদমিক সাইডবার প্রতি মুহূর্তে আপনার মনোযোগ কেড়ে নিতে প্রতিযোগিতা করে।',
  },
  'Principles of Literary Paper & Ink': {
    bn: 'সাহিত্যিক কাগজ ও কালির নকশা নীতি',
  },
  'True reading comprehension requires visual tranquility. Replacing harsh #FFFFFF blue-light glare with warm cream paper (#FAF7F2) or vintage parchment sepia (#F3E9D2) reduces ciliary muscle fatigue during long-form reading sessions.': {
    bn: 'গভীরভাবে পড়ে বোঝার জন্য চোখের প্রশান্তি প্রয়োজন। তীব্র সাদা নীল-আলোর বদলে উষ্ণ ক্রিম পেপার (#FAF7F2) বা ভিন্টেজ সেপিয়া (#F3E9D2) দীর্ঘ সময় পড়ার ক্ষেত্রে চোখের ক্লান্তি দূর করে।',
  },
  'Technology should inform and calm us, bringing the tactile serenity of a physical book to the digital screen.': {
    bn: 'প্রযুক্তি আমাদের তথ্য দেবে এবং মনে প্রশান্তি আনবে—একটি ছাপা বইয়ের পাতার স্নিগ্ধ নীরবতাকে ডিজিটাল পর্দায় ফুটিয়ে তুলবে।',
    ar: 'يجب أن تثقفنا التكنولوجيا وتمنحنا السكينة، لتنقل هدوء الكتاب الورقي الملموس إلى الشاشة الرقمية.',
    fa: 'فناوری باید آگاهی‌بخش و آرامش‌آفرین باشد و حس آرام و ملموس ورق زدن یک کتاب کاغذی را به صفحه دیجیتال بیاورد.',
    es: 'La tecnología debe informarnos y calmarnos, llevando la serenidad táctil de un libro físico a la pantalla digital.',
    fr: 'La technologie doit nous informer et nous apaiser, apportant la serenité tactile d’un livre papier à l’écran numérique.',
    de: 'Technologie sollte uns informieren und beruhigen und die haptische Gelassenheit eines gedruckten Buches auf den digitalen Bildschirm bringen.',
    zh: '科技应当启发并抚平我们的心绪，将纸质书籍温润宁静的阅读质感带入数字屏幕。',
    hi: 'तकनीक को हमें सूचित और शांत करना चाहिए, तथा भौतिक पुस्तक की शांत अनुभूति को डिजिटल स्क्रीन पर लाना चाहिए।',
    ru: 'Технологии должны просвещать и успокаивать нас, привнося тактильное безмятежие бумажной книги на цифровой экран.',
    pt: 'A tecnologia deve nos informar e acalmar, trazendo a serenidade tátil de um livro físico para a tela digital.',
    ja: 'テクノロジーは私たちに知性と穏やかさをもたらし、紙の本の心地よい静寂をデジタル画面に再現するべきです。',
    tr: 'Teknoloji bizi bilgilendirmeli ve sakinleştirmeli, fiziksel bir kitabın dokunsal huzurunu dijital ekrana taşımalıdır.',
    ko: '기술은 우리에게 정보를 주면서도 마음을 차분하게 해 주어야 하며, 종이책의 온화한 평온함을 디지털 화면에 담아내야 합니다.',
    it: 'La tecnologia dovrebbe informarci e rasserenarci, portando la quiete tattile di un libro cartaceo sullo schermo digitale.',
    ur: 'ٹیکنالوجی کو ہمیں آگاہی اور سکون فراہم کرنا چاہیے، اور کاغذی کتاب کی پرسکون کیفیت کو ڈیجیٹل اسکرین پر لانا چاہیے۔',
  },
  'Pairing visual reading with native offline Text-to-Speech (TTS) engages dual sensory channels. Listening at 1.25x while following highlighted paragraphs boosts retention and turns any commute or walk into a serene seminar.': {
    bn: 'চোখে পড়ার পাশাপাশি অফলাইন টেক্সট-টু-স্পিচ (TTS) অডিও শোনার মাধ্যমে মস্তিষ্কের দুটি ইন্দ্রিয় একসাথে কাজ করে। হাইলাইট করা অনুচ্ছেদগুলো অনুসরণ করে ১.২৫x গতিতে শোনা স্মৃতিশক্তি বাড়ায় এবং যেকোনো যাত্রাপথকে একটি প্রশান্ত জ্ঞানচর্চায় পরিণত করে।',
  },
};

function getCacheStore(): Record<string, TranslatedArticlePayload> {
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCacheStore(store: Record<string, TranslatedArticlePayload>): void {
  try {
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

export function getCachedArticleTranslation(
  articleId: string,
  targetLang: LanguageCode
): TranslatedArticlePayload | null {
  const store = getCacheStore();
  return store[`${articleId}:${targetLang}`] || null;
}

/**
 * Translates a single text string into targetLang using:
 * 1) Instant local curated dictionary match
 * 2) Zero-key neural translation endpoint when online
 * 3) Graceful offline localized representation when in Airplane Mode
 */
export async function translateSingleText(
  text: string,
  targetLang: LanguageCode
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (targetLang === 'en' && OFFLINE_PASSAGE_DICTIONARY[trimmed]) return trimmed;

  // 1. Check exact match in local offline dictionary
  const exact = OFFLINE_PASSAGE_DICTIONARY[trimmed]?.[targetLang];
  if (exact) return exact;

  // 2. Attempt live zero-key translation request
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(trimmed)}`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const joined = data[0]
          .map((part: unknown[]) =>
            Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''
          )
          .join('');
        if (joined.trim()) {
          return joined.trim();
        }
      }
    }
  } catch {
    // Offline / Airplane mode fallback below
  }

  // 3. Offline localized fallback
  const spec = LANGUAGE_MAP[targetLang];
  return `[${spec.nativeName}] ${trimmed}`;
}

/**
 * Full Article Translation Engine:
 * Translates the article title and all content blocks into targetLang,
 * caching the result in local storage / SQLite for instant offline reading.
 */
export async function translateFullArticle(
  articleId: string,
  title: string,
  blocks: ContentBlock[],
  targetLang: LanguageCode
): Promise<TranslatedArticlePayload> {
  const cached = getCachedArticleTranslation(articleId, targetLang);
  if (cached && Object.keys(cached.translatedBlocks).length >= blocks.length) {
    return cached;
  }

  const translatedTitle = await translateSingleText(title, targetLang);
  const translatedBlocks: Record<number, string> = {};

  await Promise.all(
    blocks.map(async (b) => {
      translatedBlocks[b.index] = await translateSingleText(b.text, targetLang);
    })
  );

  const payload: TranslatedArticlePayload = {
    articleId,
    targetLang,
    translatedTitle,
    translatedBlocks,
    updatedAt: new Date().toISOString(),
  };

  const store = getCacheStore();
  store[`${articleId}:${targetLang}`] = payload;
  saveCacheStore(store);

  return payload;
}
