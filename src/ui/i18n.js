// Settings UI copy. Keys stay in English so existing control logic and saved values do not change.
export const languages = [
	[ 'zh-CN', '简体中文' ], [ 'en', 'English' ], [ 'ja', '日本語' ],
	[ 'ko', '한국어' ], [ 'ar', 'العربية' ],
];

const rows = `Settings|设置|設定|설정|الإعدادات
Settings sections|设置分类|設定項目|설정 항목|أقسام الإعدادات
Language|语言|言語|언어|اللغة
Open settings|打开设置|設定を開く|설정 열기|فتح الإعدادات
Settings (H)|设置 (H)|設定 (H)|설정 (H)|الإعدادات (H)
Photo mode (P)|拍照模式 (P)|フォトモード (P)|사진 모드 (P)|وضع التصوير (P)
Controls (F1)|操作说明 (F1)|操作方法 (F1)|조작 방법 (F1)|عناصر التحكم (F1)
Collapse (H)|收起 (H)|閉じる (H)|접기 (H)|طي (H)
Hide|隐藏|非表示|숨기기|إخفاء
Controls|操作说明|操作方法|조작 방법|عناصر التحكم
Photo mode|拍照模式|フォトモード|사진 모드|وضع التصوير
Double-click to reset|双击重置|ダブルクリックでリセット|두 번 클릭하여 초기화|انقر مرتين لإعادة الضبط
Reset to default|恢复默认值|初期値に戻す|기본값으로 복원|إعادة إلى الافتراضي
Click to type a value|点击输入数值|クリックして数値を入力|클릭하여 값 입력|انقر لإدخال قيمة
Click to type a time|点击输入时间|クリックして時刻を入力|클릭하여 시간 입력|انقر لإدخال الوقت
Time of day|一天中的时间|時刻|시간대|وقت اليوم
Night|夜晚|夜|밤|الليل
Dawn|黎明|夜明け|새벽|الفجر
Sunrise|日出|日の出|일출|الشروق
Golden hour|黄金时刻|ゴールデンアワー|골든 아워|الساعة الذهبية
Morning|上午|午前|오전|الصباح
Midday|正午|正午|정오|منتصف النهار
Afternoon|下午|午後|오후|بعد الظهر
Sunset|日落|日の入り|일몰|الغروب
Dusk|黄昏|夕暮れ|황혼|الغسق
Off|关闭|オフ|끔|إيقاف
Ocean|海洋|海洋|해양|المحيط
Sea state|海况|海況|해상 상태|حالة البحر
Conditions|海况预设|海況プリセット|해상 상태 사전 설정|حالات البحر
Calm|平静|穏やか|잔잔함|هادئ
Breezy|微风|そよ風|산들바람|نسيم
Choppy|浪大|波立つ|거친 파도|مضطرب
Storm|风暴|嵐|폭풍|عاصفة
Wind speed|风速|風速|풍속|سرعة الرياح
Wind direction|风向|風向|풍향|اتجاه الرياح
Fetch|风区长度|吹送距離|취송 거리|مسافة هبوب الرياح
Choppiness|波浪陡峭度|波の険しさ|파도 거칠기|حدّة الأمواج
Ocean swell|海涌|うねり|너울|تموّج المحيط
Whitecaps|白浪|白波|백파|زبد الموج
Water|水体|水|물|الماء
Clarity|水体清澈度|水の透明度|물 투명도|صفاء الماء
Shore|海岸|海岸|해안|الشاطئ
Surf|碎浪|砕波|쇄파|الأمواج المتكسرة
Wave height|浪高|波高|파고|ارتفاع الموج
Wave period|波浪周期|波の周期|파도 주기|فترة الموج
Breaking depth ratio|破浪水深比|砕波水深比|쇄파 수심 비율|نسبة عمق تكسر الموج
Curl|卷浪强度|巻き波の強さ|말리는 파도 강도|التفاف الموج
Spray|浪花飞沫|しぶき|물보라|رذاذ الموج
Lip sheet|浪唇水幕|波先の水膜|파도 끝 물막|ستارة الماء عند قمة الموج
Boat wake|船尾航迹|航跡波|배의 항적|موج أثر القارب
Wake height|航迹浪高|航跡波の高さ|항적 파고|ارتفاع موج الأثر
Wake foam|航迹泡沫|航跡の泡|항적 거품|رغوة أثر القارب
Caustics|焦散光斑|コースティクス|카우스틱|تموجات الضوء
Intensity|强度|強度|강도|الشدة
Sky|天空|空|하늘|السماء
Sun|太阳|太陽|태양|الشمس
Sun azimuth|太阳方位角|太陽の方位角|태양 방위각|زاوية الشمس الأفقية
Advance time|时间流动|時間を進める|시간 흐르게 하기|تقدّم الوقت
Time speed|时间流速|時間の進行速度|시간 진행 속도|سرعة مرور الوقت
Atmosphere|大气|大気|대기|الغلاف الجوي
Cloud cover|云量|雲量|구름량|الغطاء السحابي
Cirrus|卷云|巻雲|권운|السحب الرقيقة
Haze|薄雾|霞|연무|الضباب الخفيف
Sun shafts|阳光光束|光芒|햇살 광선|أشعة الشمس
Air particles|空气微粒|空気中の粒子|공기 입자|جسيمات الهواء
Exposure|曝光|露出|노출|التعريض
Camera|相机|カメラ|카메라|الكاميرا
View|视角|視点|시점|العرض
Boat camera|船上视角|ボートカメラ|보트 카메라|كاميرا القارب
1st person|第一人称|一人称|1인칭|الشخص الأول
3rd person|第三人称|三人称|3인칭|الشخص الثالث
Field of view|视野范围|視野角|시야각|مجال الرؤية
Free camera (F)|自由相机 (F)|フリーカメラ (F)|자유 카메라 (F)|كاميرا حرة (F)
Effects|效果|効果|효과|المؤثرات
Post-processing|后期处理|ポストプロセス|후처리|المعالجة اللاحقة
Ambient occlusion|环境光遮蔽|アンビエントオクルージョン|앰비언트 오클루전|حجب الإضاءة المحيطة
Bounce light|反射补光|間接反射光|반사광|الضوء المنعكس
Contact shadows|接触阴影|接触シャドウ|접촉 그림자|ظلال التلامس
Sharpen|锐化|シャープ化|선명하게|زيادة الحدة
Motion blur|动态模糊|モーションブラー|모션 블러|ضبابية الحركة
Bloom|泛光|ブルーム|블룸|التوهج
Lens flare|镜头光晕|レンズフレア|렌즈 플레어|وهج العدسة
Saturation|饱和度|彩度|채도|التشبع
Contrast|对比度|コントラスト|대비|التباين
Vignette|暗角|ビネット|비네팅|تعتيم الحواف
Film grain|胶片颗粒|フィルムグレイン|필름 그레인|حبيبات الفيلم
Performance|性能|パフォーマンス|성능|الأداء
Live|实时数据|リアルタイム|실시간|بيانات مباشرة
Frame rate|帧率|フレームレート|프레임 속도|معدل الإطارات
CPU per frame|每帧 CPU 耗时|フレームごとの CPU 時間|프레임당 CPU 시간|زمن المعالج لكل إطار
Render size|渲染尺寸|描画サイズ|렌더 크기|حجم العرض
Quality|画质|画質|화질|الجودة
Dynamic resolution|动态分辨率|動的解像度|동적 해상도|الدقة الديناميكية
Render scale|渲染比例|描画倍率|렌더 배율|مقياس العرض
Shadows|阴影|影|그림자|الظلال
Water reflections|水面反射|水面反射|수면 반사|انعكاسات الماء
Wind 10 m above the sea. Drives the local wind waves, whitecaps and spray.|海面上方 10 米处的风速，影响风浪、白浪和飞沫。|海面上 10 m の風速。風浪、白波、しぶきを左右します。|해수면 위 10 m 풍속입니다. 바람 파도, 백파, 물보라에 영향을 줍니다.|سرعة الرياح على ارتفاع 10 أمتار فوق البحر؛ تؤثر في الأمواج والزبد والرذاذ.
Distance the wind has blown over open water: longer fetch, longer and higher waves.|风在开阔水面上持续吹过的距离；越长，浪越长、越高。|風が水面を吹き渡る距離。長いほど波が長く高くなります。|바람이 열린 수면 위로 분 거리입니다. 길수록 파도가 길고 높아집니다.|المسافة التي تهب خلالها الرياح فوق الماء المفتوح؛ كلما زادت، طالت الأمواج وارتفعت.
Horizontal displacement: sharp crests, wide troughs.|水平位移强度；越高，浪尖越陡、浪谷越宽。|水平方向の変位。高いほど波頭が鋭く、谷が広くなります。|수평 변위입니다. 값이 높을수록 마루는 날카롭고 골은 넓어집니다.|الإزاحة الأفقية؛ تزيد حدّة قمم الموج واتساع قيعانه.
Lower = more suspended sediment and plankton (greener, murkier).|数值越低，悬浮泥沙和浮游生物越多，水体越绿、越浑浊。|低いほど浮遊する泥やプランクトンが増え、緑がかった濁った水になります。|낮을수록 부유물과 플랑크톤이 많아져 물이 더 녹색이고 탁해집니다.|القيمة الأقل تعني رواسب وعوالق أكثر، وماء أشد خضرة وعكارة.
Waves break when height exceeds this fraction of the depth.|当浪高超过水深的这一比例时，波浪开始破碎。|波高が水深のこの割合を超えると砕波します。|파고가 수심의 이 비율을 넘으면 파도가 부서집니다.|تتكسر الأمواج عندما يتجاوز ارتفاعها هذه النسبة من العمق.
Droplets and mist thrown off breaking crests.|破浪浪尖溅起的水滴和水雾。|砕ける波頭から飛ぶ水滴や霧です。|부서지는 파도 마루에서 튀는 물방울과 물안개입니다.|قطرات ورذاذ يتطايران من قمم الأمواج المتكسرة.
The thin sheet of water thrown forward by plunging breakers.|卷落的破浪向前甩出的薄水幕。|巻き込む砕波が前方へ投げ出す薄い水の膜です。|굽이쳐 부서지는 파도가 앞으로 던지는 얇은 물막입니다.|ستارة ماء رقيقة تقذفها الأمواج المتكسرة إلى الأمام.
Turns the sun's path around the island (0 = the real path: rises in the east, sets in the west).|旋转太阳绕岛的运行轨迹（0 为真实轨迹：东升西落）。|島の周りの太陽の軌道を回します（0 は東から昇り西へ沈む実際の軌道）。|섬 주위의 태양 경로를 돌립니다(0은 동쪽에서 떠서 서쪽으로 지는 실제 경로).|يدير مسار الشمس حول الجزيرة (0 هو المسار الحقيقي: تشرق شرقًا وتغرب غربًا).
Aerial perspective and marine haze density (1 = about 20 km visibility at sea level, 0 = clear air).|空气透视和海雾浓度（1 约为海平面能见度 20 公里，0 为空气清澈）。|空気遠近法と海霧の濃さ（1 は海面で視程約 20 km、0 は澄んだ空気）。|대기 원근감과 해무 농도입니다(1은 해수면 시야 약 20 km, 0은 맑은 공기).|المنظور الجوي وكثافة الضباب البحري (1 تعني رؤية نحو 20 كم عند سطح البحر، و0 هواء صافٍ).
Volumetric light shafts and crepuscular rays in the haze (shadows of palms, the pier, hills and clouds). 0 turns them off.|薄雾中的体积光束和云隙光（棕榈树、码头、山丘及云层投下的阴影）；设为 0 可关闭。|霞の中の光芒（ヤシ、桟橋、丘、雲の影）。0 でオフにします。|연무 속 체적 광선(야자수, 부두, 언덕, 구름의 그림자)입니다. 0으로 끕니다.|أشعة ضوئية حجمية في الضباب (ظلال النخيل والرصيف والتلال والغيوم). القيمة 0 توقفها.
Dust, pollen, salt haze, seed fluff and the odd gnat drifting in the air: they catch the light when backlit by the sun. 0 turns them off.|空气中飘浮的灰尘、花粉、盐雾、绒毛和小飞虫；逆光时会显现。设为 0 可关闭。|空中を漂うほこり、花粉、塩霧、綿毛、小虫。逆光で見えます。0 でオフにします。|공중의 먼지, 꽃가루, 염분 안개, 솜털과 작은 벌레가 역광에서 보입니다. 0으로 끕니다.|غبار وحبوب لقاح ورذاذ ملحي وزغب وحشرات صغيرة تظهر في الضوء الخلفي. القيمة 0 توقفها.
Sunlight reflected off the ground (bright sand) onto undersides and shaded faces: pier, eaves, hulls, trunks. 0 = off.|地面（尤其是亮色沙地）反射到码头、屋檐、船体和树干阴面的阳光；设为 0 可关闭。|地面（明るい砂など）で反射し、桟橋や軒、船体、幹の陰面を照らす光。0 でオフ。|지면(밝은 모래 등)에서 반사되어 부두, 처마, 선체, 나무줄기의 그늘을 밝히는 빛입니다. 0으로 끕니다.|ضوء الشمس المنعكس من الأرض (مثل الرمل الفاتح) إلى أسفل الرصيف والأفاريز والهياكل والجذوع. 0 للإيقاف.
Screen-space sun shadows of small details the shadow maps miss (pebbles, shells, grass, rope). 0 = off.|补足阴影贴图遗漏的小物件接触阴影，如卵石、贝壳、草和绳索；设为 0 可关闭。|影マップが拾えない小物（小石、貝殻、草、ロープ）の画面空間シャドウ。0 でオフ。|그림자 맵이 놓치는 작은 물체(자갈, 조개, 풀, 밧줄)의 화면 공간 그림자입니다. 0으로 끕니다.|ظلال شمسية لتفاصيل صغيرة لا تلتقطها خرائط الظل (حصى وأصداف وعشب وحبال). 0 للإيقاف.
Contrast-adaptive sharpening after the temporal anti-aliasing.|时间抗锯齿处理后的自适应对比度锐化。|時間的アンチエイリアス後のコントラスト適応シャープ化。|시간적 안티앨리어싱 후 대비 적응형 선명화입니다.|زيادة حدة متكيفة مع التباين بعد تنعيم الحواف الزمني.
Camera and object motion blur, as a shutter angle (180° = film look). 0 turns it off.|按快门角度模拟相机及物体运动模糊（180° 为电影感）；设为 0 可关闭。|シャッター角度によるカメラと物体のブラー（180° は映画風）。0 でオフ。|셔터 각도에 따른 카메라 및 물체의 모션 블러입니다(180°는 영화 느낌). 0으로 끕니다.|ضبابية حركة الكاميرا والأجسام بزاوية غالق (180° لمظهر سينمائي). القيمة 0 توقفها.
Lowers the internal resolution to hold 60 fps; the temporal upscaler reconstructs full resolution.|降低内部渲染分辨率以维持 60 帧/秒，再由时域放大恢复完整分辨率。|60 fps を保つため内部解像度を下げ、時間的アップスケーラーで復元します。|60 fps 유지를 위해 내부 해상도를 낮추고 시간적 업스케일러로 복원합니다.|تخفض الدقة الداخلية للحفاظ على 60 إطارًا/ثانية ثم تعيد ترقية الصورة زمنيًا.
Screen-space reflections of the pier, boats and hills on the water.|水面上码头、船只和山丘的屏幕空间反射。|水面に映る桟橋、船、丘の画面空間反射。|수면에 비치는 부두, 배, 언덕의 화면 공간 반사입니다.|انعكاسات الرصيف والقوارب والتلال على الماء في مساحة الشاشة.`;

const column = { en: 0, 'zh-CN': 1, ja: 2, ko: 3, ar: 4 };
const dictionaries = Object.fromEntries( languages.map( ( [ code ] ) => [ code,
	new Map( rows.split( '\n' ).map( ( line ) => line.split( '|' ) ).map( ( row ) => [ row[ 0 ], row[ column[ code ] ] || row[ 0 ] ] ) ) ] ) );

export function translate( text, language = 'zh-CN' ) {
	const match = /^(Reset )(.+)$/.exec( text );
	if ( match ) {
		const name = translate( match[ 2 ], language );
		return { 'zh-CN': `重置${ name }`, ja: `${ name }をリセット`, ko: `${ name } 초기화`, ar: `إعادة ضبط ${ name }` }[ language ] || text;
	}
	return dictionaries[ language ]?.get( text ) || text;
}
