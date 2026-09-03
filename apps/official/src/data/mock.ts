/* ============ 织梦 · 模拟数据 ============ */
import type { User, Work, Post, Comment, RankingItem, Course, Order, DashboardData, CartItem } from './types';

export const img = (name: string) => `/images/${name}`;

/* ---------- 用户 ---------- */
export const users: User[] = [
  { id: 1, nickname: '小织', avatar: img('avatar-01.jpg'), level: 3, bio: '独立设计师｜专注法式浪漫风', followers: 128000, following: 236, role: 'creator', works: 42 },
  { id: 2, nickname: '鹿屿Lu', avatar: img('avatar-02.jpg'), level: 3, bio: '主理人｜做有温度的衣服', followers: 86200, following: 112, role: 'brand', brandName: 'LU ISLAND', works: 36 },
  { id: 3, nickname: '云端裁缝铺', avatar: img('avatar-03.jpg'), level: 2, bio: '从打版师到设计师｜分享工艺细节', followers: 45100, following: 328, role: 'creator', works: 28 },
  { id: 4, nickname: '莓莓酱', avatar: img('avatar-04.jpg'), level: 1, bio: '设计学徒学习中～', followers: 8900, following: 1204, role: 'creator', works: 12 },
  { id: 5, nickname: 'Ginger阿姜', avatar: img('avatar-05.jpg'), level: 2, bio: '复古工装爱好者', followers: 22300, following: 465, role: 'creator', works: 19 },
  { id: 6, nickname: '山茶与猫', avatar: img('avatar-06.jpg'), level: 1, bio: '记录穿搭灵感', followers: 5600, following: 890, role: 'consumer', works: 6 },
  { id: 7, nickname: '四月的裙子', avatar: img('avatar-07.jpg'), level: 0, bio: '四月到了就想穿裙子', followers: 1200, following: 356, role: 'consumer', works: 0 },
  { id: 8, nickname: '木棉设计工作室', avatar: img('avatar-08.jpg'), level: 3, bio: '木棉棉麻 · 东方美学', followers: 156000, following: 89, role: 'brand', brandName: '木棉', works: 58 },
  { id: 9, nickname: '眠眠兔', avatar: img('avatar-09.jpg'), level: 1, bio: '软妹风设计师', followers: 18700, following: 632, role: 'creator', works: 15 },
  { id: 10, nickname: '针织日记', avatar: img('avatar-10.jpg'), level: 2, bio: '手织毛衫的温度', followers: 33400, following: 214, role: 'creator', works: 24 },
  { id: 11, nickname: 'Momo莫莫', avatar: img('avatar-11.jpg'), level: 0, bio: '求推荐通勤穿搭！', followers: 860, following: 458, role: 'consumer', works: 0 },
  { id: 12, nickname: '丝语Silk', avatar: img('avatar-12.jpg'), level: 2, bio: '真丝面料研究员', followers: 41200, following: 178, role: 'creator', works: 21 },
  { id: 13, nickname: '青禾定制', avatar: img('avatar-13.jpg'), level: 3, bio: '轻定制西装｜一人一版', followers: 97400, following: 96, role: 'brand', brandName: '青禾', works: 33 },
  { id: 14, nickname: '我的小号', avatar: img('avatar-14.jpg'), level: 0, bio: '', followers: 12, following: 108, role: 'consumer', works: 3 },
  { id: 15, nickname: '小岛花事', avatar: img('avatar-15.jpg'), level: 1, bio: '碎花爱好者', followers: 7300, following: 556, role: 'creator', works: 9 },
  { id: 16, nickname: '白鹭Ling', avatar: img('avatar-16.jpg'), level: 2, bio: '极简通勤｜白衬衫狂魔', followers: 28900, following: 302, role: 'creator', works: 17 },
  { id: 17, nickname: '碎星', avatar: img('avatar-17.jpg'), level: 1, bio: '正在学打版', followers: 4200, following: 733, role: 'creator', works: 8 },
  { id: 18, nickname: '凉拌冰沙', avatar: img('avatar-18.jpg'), level: 0, bio: '观望中…', followers: 90, following: 210, role: 'consumer', works: 0 },
];

export const ME_ID = 14; // 当前登录用户
export const me = users.find((u) => u.id === ME_ID)!;

export const userById = (id: number) => users.find((u) => u.id === id) || users[0];

/* ---------- 作品 ---------- */
export const works: Work[] = [
  { id: 101, title: '法式碎花泡泡袖连衣裙', creatorId: 1, category: '连衣裙', styleTags: ['法式', '碎花', '泡泡袖'], fabric: '100%真丝', price: 328, cover: img('dress-01.jpg'), colors: [{ name: '奶油白', hex: '#F5EFE6' }, { name: '雾霾蓝', hex: '#9FB4C7' }], sizes: ['XS', 'S', 'M', 'L', 'XL'], sales: 1286, likes: 3421, collects: 2156, views: 48200, desc: '灵感来自南法仲夏的花园，细密碎花与复古泡泡袖结合，收腰显瘦。\n· 100%重磅真丝，垂坠感极佳\n· 泡泡袖立体剪裁，肩部修饰\n· 隐藏式侧拉链，穿着舒适', isCustom: true, returnRate: 4.2, productionDays: 10 },
  { id: 102, title: '雾色晨雾 · 羊毛混纺大衣', creatorId: 2, brandId: 1, category: '外套', styleTags: ['韩系', '极简', '大衣'], fabric: '70%羊毛混纺', price: 899, cover: img('coat-02.jpg'), colors: [{ name: '燕麦色', hex: '#D8CFC2' }, { name: '炭灰色', hex: '#4A4A52' }], sizes: ['S', 'M', 'L'], sales: 856, likes: 2890, collects: 1932, views: 35600, desc: '廓形利落的高级感大衣，双层工艺保暖不臃肿。\n· 70%澳洲羊毛，挺括有型\n· 手工对条工艺，细节考究', isCustom: true, returnRate: 3.1, productionDays: 12 },
  { id: 103, title: '木棉之夏 · 亚麻衬衫裙', creatorId: 8, brandId: 2, category: '连衣裙', styleTags: ['东方', '棉麻', '通勤'], fabric: '55%亚麻+45%棉', price: 259, cover: img('dress-11.jpg'), colors: [{ name: '本白', hex: '#F3EFE8' }, { name: '苔绿', hex: '#7C8A6F' }], sizes: ['S', 'M', 'L', 'XL'], sales: 2104, likes: 5120, collects: 3420, views: 68900, desc: '东方美学与舒适棉麻的结合，宽松廓形不挑身材。', isCustom: true, returnRate: 2.4, productionDays: 9 },
  { id: 104, title: '午后花园 · 泡泡袖方领上衣', creatorId: 9, category: '衬衫', styleTags: ['甜美', '泡泡袖', '方领'], fabric: '棉涤混纺', price: 149, cover: img('blouse-01.jpg'), colors: [{ name: '蜜桃粉', hex: '#F2B8C0' }, { name: '奶白', hex: '#F7F3EC' }], sizes: ['S', 'M', 'L'], sales: 3420, likes: 7840, collects: 5210, views: 102400, desc: '方领+泡泡袖的减龄组合，复古甜美感拉满。', isCustom: false, returnRate: 6.8, productionDays: 7 },
  { id: 105, title: '通勤利落 · 高腰阔腿裤', creatorId: 16, category: '裤装', styleTags: ['极简', '通勤', '阔腿'], fabric: '垂感雪纺', price: 219, cover: img('pants-02.jpg'), colors: [{ name: '黑色', hex: '#2B2B30' }, { name: '卡其', hex: '#B9A688' }], sizes: ['S', 'M', 'L', 'XL'], sales: 1650, likes: 3240, collects: 2310, views: 45200, desc: '九分高腰阔腿，垂坠面料自带高级感，通勤首选。', isCustom: true, returnRate: 3.6, productionDays: 8 },
  { id: 106, title: '周末咖啡厅 · 针织开衫', creatorId: 10, category: '外套', styleTags: ['韩系', '针织', '慵懒'], fabric: '40%羊毛+腈纶', price: 269, cover: img('knit-01.jpg'), colors: [{ name: '奶咖', hex: '#C9B8A3' }, { name: '雾紫', hex: '#A99BB5' }], sizes: ['均码'], sales: 986, likes: 2540, collects: 1760, views: 31200, desc: '软糯的手织感开衫，慵懒复古风。', isCustom: true, returnRate: 2.1, productionDays: 11 },
  { id: 107, title: '工装记忆 · 直筒半裙', creatorId: 5, category: '半裙', styleTags: ['复古', '工装', '半裙'], fabric: '棉质斜纹', price: 189, cover: img('skirt-01.jpg'), colors: [{ name: '军绿', hex: '#5A6650' }, { name: '卡其', hex: '#B9A688' }], sizes: ['S', 'M', 'L'], sales: 742, likes: 1680, collects: 1120, views: 24600, desc: '直筒廓形+大口袋设计，复古工装感十足。', isCustom: true, returnRate: 2.8, productionDays: 8 },
  { id: 108, title: '晨光缎面 · 真丝半裙', creatorId: 12, category: '半裙', styleTags: ['知性', '真丝', '缎面'], fabric: '100%桑蚕丝', price: 399, cover: img('skirt-02.jpg'), colors: [{ name: '香槟金', hex: '#D9C6A5' }, { name: '酒红', hex: '#7E2E3A' }], sizes: ['S', 'M', 'L'], sales: 523, likes: 1980, collects: 1420, views: 28400, desc: '真丝缎面自带光泽，行走间流光溢彩。', isCustom: true, returnRate: 5.2, productionDays: 12 },
  { id: 109, title: '南法假日 · 方领短裙', creatorId: 15, category: '半裙', styleTags: ['法式', '碎花', '短裙'], fabric: '纯棉', price: 159, cover: img('skirt-03.jpg'), colors: [{ name: '樱桃红', hex: '#C2544E' }, { name: '藏青', hex: '#3A4A63' }], sizes: ['S', 'M', 'L'], sales: 2310, likes: 4650, collects: 3100, views: 58700, desc: '夏日必备的法式碎花短裙，A字廓形显腿长。', isCustom: false, returnRate: 7.5, productionDays: 7 },
  { id: 110, title: '云朵白 · 基础款T恤', creatorId: 16, category: '衬衫', styleTags: ['极简', '基础款'], fabric: '精梳棉', price: 79, cover: img('tshirt-02.jpg'), colors: [{ name: '白色', hex: '#F6F4F0' }, { name: '燕麦', hex: '#D8CFC2' }], sizes: ['S', 'M', 'L', 'XL'], sales: 5670, likes: 8920, collects: 6040, views: 124000, desc: '克重230g的精梳棉T恤，版型经过12次调整。', isCustom: false, returnRate: 8.9, productionDays: 5 },
  { id: 111, title: '几何韵律 · 羊毛西装外套', creatorId: 13, brandId: 3, category: '外套', styleTags: ['职业', '西装', '定制'], fabric: '精纺羊毛', price: 1299, cover: img('suit-01.jpg'), colors: [{ name: '深藏青', hex: '#27324A' }, { name: '炭灰', hex: '#4A4A52' }], sizes: ['S', 'M', 'L', 'XL'], sales: 412, likes: 1560, collects: 980, views: 19800, desc: '一人一版轻定制西装，肩线服帖挺括。', isCustom: true, returnRate: 1.8, productionDays: 15 },
  { id: 112, title: '初夏微风 · 泡泡纱衬衫', creatorId: 3, category: '衬衫', styleTags: ['通勤', '清爽', '泡泡纱'], fabric: '泡泡纱棉', price: 199, cover: img('blouse-02.jpg'), colors: [{ name: '天空蓝', hex: '#A8C4D6' }, { name: '白色', hex: '#F6F4F0' }], sizes: ['S', 'M', 'L'], sales: 1432, likes: 3120, collects: 2210, views: 39800, desc: '泡泡纱自带空气感，夏日不闷热。', isCustom: true, returnRate: 3.9, productionDays: 8 },
  { id: 113, title: '甜心波点 · 复古连衣裙', creatorId: 9, category: '连衣裙', styleTags: ['复古', '波点', '甜美'], fabric: '棉质', price: 239, cover: img('dress-03.jpg'), colors: [{ name: '黑底白点', hex: '#2B2B30' }, { name: '白底黑点', hex: '#F6F4F0' }], sizes: ['S', 'M', 'L'], sales: 1836, likes: 4210, collects: 2890, views: 52300, desc: '经典波点+收腰伞裙摆，复古优雅。', isCustom: true, returnRate: 4.5, productionDays: 9 },
  { id: 114, title: '苔原漫步 · 工装夹克', creatorId: 5, category: '外套', styleTags: ['工装', '户外', '机能'], fabric: '水洗棉帆布', price: 359, cover: img('jacket-01.jpg'), colors: [{ name: '军绿', hex: '#5A6650' }, { name: '沙色', hex: '#C2B49F' }], sizes: ['S', 'M', 'L', 'XL'], sales: 668, likes: 1840, collects: 1260, views: 27600, desc: '多口袋机能设计，耐磨水洗棉帆布。', isCustom: true, returnRate: 2.2, productionDays: 10 },
  { id: 115, title: '梨涡浅笑 · 蕾丝拼接连衣裙', creatorId: 4, category: '连衣裙', styleTags: ['甜美', '蕾丝', '约会'], fabric: '蕾丝+内衬', price: 289, cover: img('dress-15.jpg'), colors: [{ name: '香芋紫', hex: '#B9A7D9' }, { name: '粉色', hex: '#F2B8C0' }], sizes: ['S', 'M', 'L'], sales: 918, likes: 2760, collects: 1890, views: 33400, desc: '蕾丝与网纱的浪漫碰撞，约会穿搭首选。', isCustom: true, returnRate: 5.6, productionDays: 9 },
  { id: 116, title: '山茶白 · 醋酸半裙', creatorId: 12, category: '半裙', styleTags: ['知性', '醋酸', '垂坠'], fabric: '醋酸面料', price: 249, cover: img('skirt-04.jpg'), colors: [{ name: '奶白', hex: '#F3EFE8' }, { name: '灰色', hex: '#9B9B9F' }], sizes: ['S', 'M', 'L'], sales: 776, likes: 2130, collects: 1540, views: 26500, desc: '醋酸面料垂坠感好，抗皱易打理。', isCustom: true, returnRate: 3.3, productionDays: 8 },
  { id: 117, title: '微醺玫瑰 · 吊带连衣裙', creatorId: 1, category: '连衣裙', styleTags: ['法式', '缎面', '吊带'], fabric: '醋酸缎面', price: 299, cover: img('dress-18.jpg'), colors: [{ name: '玫瑰粉', hex: '#E8A0B0' }, { name: '黑色', hex: '#2B2B30' }], sizes: ['XS', 'S', 'M', 'L'], sales: 1345, likes: 3980, collects: 2670, views: 41200, desc: '缎面吊带裙，微光质感，约会之夜的最佳主角。', isCustom: true, returnRate: 6.1, productionDays: 10 },
  { id: 118, title: '少年感 · 廓形连帽卫衣', creatorId: 16, category: '衬衫', styleTags: ['休闲', '卫衣', 'oversize'], fabric: '毛圈棉', price: 199, cover: img('top-01.jpg'), colors: [{ name: '燕麦', hex: '#D8CFC2' }, { name: '雾蓝', hex: '#9FB4C7' }], sizes: ['S', 'M', 'L', 'XL'], sales: 2890, likes: 5230, collects: 3410, views: 67400, desc: '420g重磅毛圈棉，oversize廓形慵懒有型。', isCustom: false, returnRate: 7.2, productionDays: 6 },
  { id: 119, title: '午夜蓝调 · 丝绒西装裙', creatorId: 13, brandId: 3, category: '连衣裙', styleTags: ['晚宴', '丝绒', '高级'], fabric: '天鹅绒', price: 799, cover: img('dress-07.jpg'), colors: [{ name: '午夜蓝', hex: '#2A3B5C' }], sizes: ['S', 'M', 'L'], sales: 356, likes: 1420, collects: 890, views: 16800, desc: '丝绒的光泽与垂坠，晚宴场合的优雅答案。', isCustom: true, returnRate: 4.8, productionDays: 13 },
  { id: 120, title: '雾屿 · 针织半裙套装', creatorId: 10, category: '套装', styleTags: ['韩系', '针织', '套装'], fabric: '羊毛混纺', price: 459, cover: img('knit-02.jpg'), colors: [{ name: '燕麦', hex: '#D8CFC2' }, { name: '雾灰', hex: '#9B9B9F' }], sizes: ['S', 'M', 'L'], sales: 428, likes: 1350, collects: 920, views: 19800, desc: '上衣+半裙的套装组合，省心又高级。', isCustom: true, returnRate: 2.9, productionDays: 11 },
  { id: 121, title: '盛夏柠檬 · 短袖衬衫', creatorId: 15, category: '衬衫', styleTags: ['度假', '印花', '短袖'], fabric: '人棉', price: 139, cover: img('tshirt-03.jpg'), colors: [{ name: '柠檬黄', hex: '#F2D06B' }], sizes: ['S', 'M', 'L'], sales: 1980, likes: 3420, collects: 2250, views: 45600, desc: '清爽的柠檬印花，度假通勤两相宜。', isCustom: false, returnRate: 6.9, productionDays: 6 },
  { id: 122, title: '冬日序曲 · 双面呢大衣', creatorId: 2, brandId: 1, category: '外套', styleTags: ['韩系', '双面呢', '大衣'], fabric: '90%羊毛双面呢', price: 1299, cover: img('coat-03.jpg'), colors: [{ name: '驼色', hex: '#B58F6A' }, { name: '黑色', hex: '#2B2B30' }], sizes: ['S', 'M', 'L'], sales: 512, likes: 2310, collects: 1680, views: 28900, desc: '手工缝制的双面呢大衣，冬天里的温柔铠甲。', isCustom: true, returnRate: 2.0, productionDays: 15 },
  /* —— 当前登录用户（我的小号）的作品 —— */
  { id: 130, title: '初见 · 泡泡袖连衣裙', creatorId: 14, category: '连衣裙', styleTags: ['甜美', '泡泡袖'], fabric: '棉质', price: 199, cover: img('dress-06.jpg'), colors: [{ name: '樱粉', hex: '#F2B8C0' }], sizes: ['S', 'M', 'L'], sales: 36, likes: 128, collects: 56, views: 4200, desc: '我的第一件原创设计，灵感来自春天的樱花。', isCustom: true, returnRate: 6.5, productionDays: 8 },
  { id: 131, title: '格子序章 · 复古半裙', creatorId: 14, category: '半裙', styleTags: ['复古', '格子'], fabric: '棉质斜纹', price: 129, cover: img('skirt-04.jpg'), colors: [{ name: '红格', hex: '#B0544C' }], sizes: ['S', 'M', 'L'], sales: 12, likes: 45, collects: 23, views: 1560, desc: '学习打版后完成的第二个作品。', isCustom: true, returnRate: 5.1, productionDays: 7 },
  { id: 132, title: '风衣构想 · 初稿', creatorId: 14, category: '外套', styleTags: ['极简', '风衣'], fabric: '棉感风衣料', price: 399, cover: img('style-13.jpg'), colors: [{ name: '卡其', hex: '#B9A688' }], sizes: ['S', 'M', 'L'], sales: 3, likes: 21, collects: 9, views: 890, desc: '还在完善中的风衣设计，欢迎提意见～', isCustom: true, returnRate: 0, productionDays: 12 },
];

export const workById = (id: number) => works.find((w) => w.id === id);
export const worksByCreator = (creatorId: number) => works.filter((w) => w.creatorId === creatorId);

/* ---------- 推文 ---------- */
export const posts: Post[] = [
  { id: 1001, authorId: 1, content: '南法的夏天藏在碎花里🌿 新设计的「法式碎花泡泡袖连衣裙」终于打版完成啦！\n真丝面料垂坠感绝了，泡泡袖一点也不显肩宽～\n搭配草帽和编织包，就是电影女主角。\n#法式穿搭 #碎花 #泡泡袖 #原创设计', images: [img('dress-01.jpg'), img('style-01.jpg'), img('style-05.jpg')], mediaType: 'image', linkedWorkIds: [101], tags: ['#法式穿搭', '#碎花', '#泡泡袖', '#原创设计'], likeCount: 3421, collectCount: 2156, commentCount: 386, shareCount: 214, time: '2小时前' },
  { id: 1002, authorId: 3, content: '打版小课堂｜一条连衣裙的诞生需要几步？\n今天带大家看看从纸样到胚布的全过程✂️\n· 1:1纸样推版\n· 胚布试穿修正\n· 正式面料裁剪\n每一步都是细节！\n#打版 #工艺 #服装设计', images: [img('craft-01.jpg'), img('craft-02.jpg'), img('fabric-01.jpg')], mediaType: 'image', linkedWorkIds: [], tags: ['#打版', '#工艺', '#服装设计'], likeCount: 1280, collectCount: 890, commentCount: 156, shareCount: 98, time: '5小时前' },
  { id: 1003, authorId: 2, content: '「雾色晨雾」大衣的羊毛面料到货啦！\n70%澳洲羊毛，手感真的绝了，有分量但不压身。\n双面呢工艺，反面也看不见线头，强迫症狂喜。\n今晚直播间看面料细节，不见不散～\n#羊毛大衣 #韩系穿搭 #面料', images: [img('coat-02.jpg'), img('fabric-03.jpg')], mediaType: 'video', linkedWorkIds: [102], tags: ['#羊毛大衣', '#韩系穿搭', '#面料'], likeCount: 2890, collectCount: 1932, commentCount: 245, shareCount: 176, time: '8小时前' },
  { id: 1004, authorId: 6, content: '收到定制的小裙子啦！一键适配体模预览和实物几乎一样🥹\n腰线收得刚刚好，完全不用改。\n定制衣物虽然不能退，但看到成品的这一刻真的值得！\n#买家秀 #定制体验 #连衣裙', images: [img('style-02.jpg'), img('dress-04.jpg')], mediaType: 'image', linkedWorkIds: [103], tags: ['#买家秀', '#定制体验'], likeCount: 890, collectCount: 420, commentCount: 132, shareCount: 66, time: '12小时前' },
  { id: 1005, authorId: 5, content: '工装女孩的衣柜：直筒半裙×3种穿法\n1️⃣ 搭白T+帆布鞋，休闲出街\n2️⃣ 搭针织背心+乐福鞋，复古学院\n3️⃣ 搭衬衫+靴子，帅气通勤\n一条裙子穿出三种风格，买它！\n#工装风 #半裙 #一衣多穿', images: [img('skirt-01.jpg'), img('style-03.jpg'), img('style-04.jpg')], mediaType: 'image', linkedWorkIds: [107], tags: ['#工装风', '#半裙', '#一衣多穿'], likeCount: 1680, collectCount: 1120, commentCount: 189, shareCount: 143, time: '昨天' },
  { id: 1006, authorId: 10, content: '手织的第12件毛衣完工🧶\n这次用羊毛混纺，软到想埋进去。\n缝纫机走线的声音真的很治愈，拍了过程视频～\n#针织 #手作 #毛衣', images: [img('knit-01.jpg'), img('style-06.jpg')], mediaType: 'video', linkedWorkIds: [106], tags: ['#针织', '#手作'], likeCount: 2540, collectCount: 1760, commentCount: 312, shareCount: 204, time: '昨天' },
  { id: 1007, authorId: 9, content: '甜心波点裙上线！黑底白点yyds✨\n收腰+伞摆，梨形身材也能放心冲。\n这周榜单冲鸭！给我投票的宝子们mua～\n#波点 #复古 #连衣裙', images: [img('dress-03.jpg')], mediaType: 'image', linkedWorkIds: [113], tags: ['#波点', '#复古'], likeCount: 4210, collectCount: 2890, commentCount: 458, shareCount: 267, time: '2天前' },
  { id: 1008, authorId: 8, content: '木棉之夏：亚麻衬衫裙的设计手稿📐\n从东方园林的疏影里取色，苔绿+本白。\n亚麻的褶皱是它最自然的表情，不完美即完美。\n#东方美学 #棉麻 #设计手稿', images: [img('dress-11.jpg'), img('style-07.jpg'), img('fabric-02.jpg')], mediaType: 'image', linkedWorkIds: [103], tags: ['#东方美学', '#棉麻', '#设计手稿'], likeCount: 5120, collectCount: 3420, commentCount: 521, shareCount: 386, time: '3天前' },
  { id: 1009, authorId: 12, content: '真丝知识小课堂｜桑蚕丝vs柞蚕丝\n桑蚕丝：细腻光泽，适合贴身衣物\n柞蚕丝：粗犷天然，做外套更有风骨\n选购真丝记得看「品类+克重」两个指标哦～\n#面料知识 #真丝 #科普', images: [img('fabric-03.jpg'), img('skirt-02.jpg')], mediaType: 'image', linkedWorkIds: [108], tags: ['#面料知识', '#真丝'], likeCount: 1980, collectCount: 1560, commentCount: 276, shareCount: 310, time: '3天前' },
  { id: 1010, authorId: 16, content: '白衬衫重度患者的第17件：泡泡纱款！\n自带褶皱的空气感，通勤穿一整天都不闷。\n建议搭配九分西裤+乐福鞋，清爽利落。\n#通勤穿搭 #白衬衫 #夏日', images: [img('blouse-02.jpg'), img('style-08.jpg')], mediaType: 'image', linkedWorkIds: [112], tags: ['#通勤穿搭', '#白衬衫'], likeCount: 3120, collectCount: 2210, commentCount: 198, shareCount: 165, time: '4天前' },
  { id: 1011, authorId: 4, content: '设计学徒的第一次打版作业！\n蕾丝拼接连衣裙终于通过老师审核啦🥳\n从画设计图到打版用了整整两周，每一步都在学习中心找教程。\n#设计学徒 #学习打卡 #蕾丝', images: [img('dress-15.jpg'), img('style-09.jpg')], mediaType: 'image', linkedWorkIds: [115], tags: ['#设计学徒', '#学习打卡'], likeCount: 2760, collectCount: 1890, commentCount: 423, shareCount: 178, time: '5天前' },
  { id: 1012, authorId: 13, content: '轻定制西装的小众答案｜一人一版\n为什么定制西装合身？因为版型从你的体型数据开始。\n肩宽、臂长、背长…12项数据全部用上，绝不套版。\n#定制西装 #一人一版 #职业装', images: [img('suit-01.jpg'), img('style-10.jpg')], mediaType: 'image', linkedWorkIds: [111], tags: ['#定制西装', '#一人一版'], likeCount: 1560, collectCount: 980, commentCount: 167, shareCount: 89, time: '1周前' },
];

export const postById = (id: number) => posts.find((p) => p.id === id);

export const commentsByPost: Record<number, Comment[]> = {
  1001: [
    { id: 1, postId: 1001, userId: 7, content: '救命！这件也太好看了吧😍 已下单', likes: 56, time: '1小时前' },
    { id: 2, postId: 1001, userId: 11, content: '请问泡泡袖会不会显肩宽呀？', likes: 12, time: '1小时前', replyTo: '小织' },
    { id: 3, postId: 1001, userId: 1, content: '回复@Momo莫莫：不会的，肩线做了内收处理，实际试穿很显瘦～', likes: 38, time: '50分钟前' },
    { id: 4, postId: 1001, userId: 18, content: '真丝会不会很难打理？', likes: 8, time: '30分钟前' },
  ],
  1003: [
    { id: 1, postId: 1003, userId: 7, content: '大衣质感看起来好好，蹲一个价格', likes: 21, time: '6小时前' },
  ],
  1007: [
    { id: 1, postId: 1007, userId: 6, content: '波点裙绝绝子！已投10票✌️', likes: 15, time: '1天前' },
  ],
};

/* ---------- 榜单 ---------- */
export const rankings: RankingItem[] = [
  { workId: 103, periodType: 1, rank: 1, voteScore: 862, collectScore: 684, salesScore: 631, interactionScore: 428, totalScore: 87.4, votes: 2873 },
  { workId: 101, periodType: 1, rank: 2, voteScore: 791, collectScore: 431, salesScore: 386, interactionScore: 512, totalScore: 82.1, votes: 2636 },
  { workId: 104, periodType: 1, rank: 3, voteScore: 684, collectScore: 1042, salesScore: 1026, interactionScore: 356, totalScore: 78.9, votes: 2280 },
  { workId: 118, periodType: 1, rank: 4, voteScore: 597, collectScore: 682, salesScore: 867, interactionScore: 289, totalScore: 74.6, votes: 1990 },
  { workId: 109, periodType: 1, rank: 5, voteScore: 542, collectScore: 620, salesScore: 693, interactionScore: 312, totalScore: 71.8, votes: 1806 },
  { workId: 102, periodType: 1, rank: 6, voteScore: 489, collectScore: 387, salesScore: 257, interactionScore: 426, totalScore: 66.3, votes: 1630 },
  { workId: 113, periodType: 1, rank: 7, voteScore: 452, collectScore: 578, salesScore: 551, interactionScore: 245, totalScore: 64.9, votes: 1506 },
  { workId: 110, periodType: 1, rank: 8, voteScore: 398, collectScore: 1208, salesScore: 1701, interactionScore: 178, totalScore: 63.1, votes: 1327 },
  { workId: 115, periodType: 1, rank: 9, voteScore: 356, collectScore: 378, salesScore: 275, interactionScore: 312, totalScore: 58.7, votes: 1186 },
  { workId: 117, periodType: 1, rank: 10, voteScore: 331, collectScore: 534, salesScore: 404, interactionScore: 246, totalScore: 57.2, votes: 1103 },
  { workId: 121, periodType: 1, rank: 11, voteScore: 298, collectScore: 450, salesScore: 594, interactionScore: 189, totalScore: 55.8, votes: 993 },
  { workId: 108, periodType: 1, rank: 12, voteScore: 264, collectScore: 284, salesScore: 157, interactionScore: 342, totalScore: 53.6, votes: 880 },
];

export const rankingByPeriod: Record<number, RankingItem[]> = {
  1: rankings,
  2: rankings.map((r, i) => ({ ...r, rank: i + 1, periodType: 2 as const, votes: r.votes * 3, totalScore: r.totalScore + 5 })).sort((a, b) => b.totalScore - a.totalScore).map((r, i) => ({ ...r, rank: i + 1 })),
  3: rankings.map((r, i) => ({ ...r, rank: i + 1, periodType: 3 as const, votes: r.votes * 8, totalScore: r.totalScore + 8 })).sort((a, b) => b.totalScore - a.totalScore).map((r, i) => ({ ...r, rank: i + 1 })),
};

/* ---------- 课程 ---------- */
export const courses: Course[] = [
  { id: 201, title: '认识100种常见面料', instructorId: 12, category: '面料知识', level: 1, duration: 45 * 60, learners: 128000, cover: img('fabric-01.jpg'), desc: '从棉麻丝毛到科技面料，一次讲透面料的性格、质感与适用场景，是设计师的第一堂必修课。', outline: [
    { title: '天然纤维：棉麻丝毛', duration: 15 * 60, done: true },
    { title: '化学纤维：涤纶锦纶氨纶', duration: 12 * 60, done: true },
    { title: '混纺与新型面料', duration: 10 * 60, done: true },
    { title: '面料手感判断实操', duration: 8 * 60 },
  ], isUserUploaded: false, playCount: 980000, certified: true },
  { id: 202, title: '色彩搭配入门：从理论到实操', instructorId: 3, category: '设计基础', level: 1, duration: 32 * 60, learners: 96000, cover: img('style-15.jpg'), desc: '色彩三要素、互补色/邻近色法则、风格定调，搭配大量成衣案例分析，快速建立配色手感。', outline: [
    { title: '色彩三要素：色相明度纯度', duration: 10 * 60, done: true },
    { title: '经典配色公式', duration: 8 * 60 },
    { title: '根据肤色选颜色', duration: 7 * 60 },
    { title: '成衣配色案例拆解', duration: 7 * 60 },
  ], isUserUploaded: false, playCount: 740000, certified: true },
  { id: 203, title: '连衣裙打版实操（附纸样）', instructorId: 3, category: '打版技巧', level: 2, duration: 68 * 60, learners: 42000, cover: img('craft-01.jpg'), desc: '从原型版到公主线连衣裙完整打版流程，附赠1:1纸样源文件，跟着做就能完成自己的第一件作品。', outline: [
    { title: '原型版绘制', duration: 15 * 60 },
    { title: '省道转移与公主线', duration: 14 * 60 },
    { title: '袖型与领口处理', duration: 13 * 60 },
    { title: '胚布试穿修正', duration: 12 * 60 },
    { title: '放码与排料', duration: 14 * 60 },
  ], isUserUploaded: false, playCount: 320000 },
  { id: 204, title: '缝纫工艺入门：车缝与锁边', instructorId: 10, category: '打版技巧', level: 2, duration: 40 * 60, learners: 51000, cover: img('craft-02.jpg'), desc: '认识家用缝纫机、掌握直线车缝、锁边、包边等基础工艺，零基础也能做出平整的缝合线。', outline: [
    { title: '认识缝纫机与针距', duration: 10 * 60 },
    { title: '直线车缝练习', duration: 8 * 60 },
    { title: '锁边与包边工艺', duration: 12 * 60 },
    { title: '常见缝纫问题排查', duration: 10 * 60 },
  ], isUserUploaded: false, playCount: 410000 },
  { id: 205, title: '设计软件从零开始（CLO 3D）', instructorId: 1, category: '软件操作', level: 2, duration: 96 * 60, learners: 28000, cover: img('style-17.jpg'), desc: '主流3D服装设计软件全流程教学：建模、缝纫、面料仿真、虚拟试衣，让设计在虚拟空间提前"成衣"。', outline: [
    { title: '界面与基础操作', duration: 15 * 60 },
    { title: '2D版片绘制', duration: 20 * 60 },
    { title: '3D缝纫与装配', duration: 22 * 60 },
    { title: '面料属性与物理仿真', duration: 18 * 60 },
    { title: '渲染出图与动画', duration: 21 * 60 },
  ], isUserUploaded: false, playCount: 186000 },
  { id: 206, title: '如何打造爆款设计', instructorId: 2, category: '趋势分析', level: 3, duration: 55 * 60, learners: 19000, cover: img('style-18.jpg'), desc: '拆解平台热度算法与爆款作品共性：选题、风格、定价、榜单运营，数据驱动的设计方法论。', outline: [
    { title: '读懂榜单热度算法', duration: 12 * 60 },
    { title: '爆款作品特征拆解', duration: 15 * 60 },
    { title: '定价与上架策略', duration: 12 * 60 },
    { title: '投票与互动运营', duration: 16 * 60 },
  ], isUserUploaded: false, playCount: 128000 },
  { id: 207, title: '个人品牌运营指南', instructorId: 2, category: '品牌运营', level: 3, duration: 62 * 60, learners: 12000, cover: img('style-19.jpg'), desc: '从0到1孵化个人品牌：品牌定位、内容矩阵、粉丝运营、供应链对接与品牌孵化申请全流程。', outline: [
    { title: '品牌定位与命名', duration: 12 * 60 },
    { title: '内容与账号运营', duration: 15 * 60 },
    { title: '供应链合作模式', duration: 14 * 60 },
    { title: '品牌孵化申请指南', duration: 21 * 60 },
  ], isUserUploaded: false, playCount: 89000 },
  { id: 208, title: '真丝面料鉴定与护理', instructorId: 12, category: '面料知识', level: 1, duration: 28 * 60, learners: 45000, cover: img('fabric-03.jpg'), desc: '燃烧法、手感法、光泽法…三招识别真假真丝，附真丝衣物洗涤护理全攻略。', outline: [
    { title: '真丝的种类与等级', duration: 9 * 60 },
    { title: '鉴别方法实操', duration: 10 * 60 },
    { title: '洗涤与收纳护理', duration: 9 * 60 },
  ], isUserUploaded: false, playCount: 356000 },
  { id: 209, title: '小白也能做的法式碎花设计', instructorId: 1, category: '设计基础', level: 1, duration: 38 * 60, learners: 68000, cover: img('dress-01.jpg'), desc: '从灵感收集、碎花排版、色彩定调到成衣效果，一节课带你完成法式碎花裙从0到1的设计。', outline: [
    { title: '法式风格拆解', duration: 10 * 60 },
    { title: '印花图案设计', duration: 9 * 60 },
    { title: '款式与版型搭配', duration: 10 * 60 },
    { title: '成衣效果模拟', duration: 9 * 60 },
  ], isUserUploaded: false, playCount: 520000 },
  { id: 210, title: '如何给买家拍出好看的试穿图', instructorId: 4, category: '品牌运营', level: 1, duration: 25 * 60, learners: 31000, cover: img('style-02.jpg'), desc: '构图、光线、姿势、后期，四个维度提升你的买家秀质感，顺便提升作品转化率。', outline: [
    { title: '构图与机位', duration: 8 * 60 },
    { title: '光线运用', duration: 6 * 60 },
    { title: '摆姿与氛围', duration: 6 * 60 },
    { title: '后期调色速成', duration: 5 * 60 },
  ], isUserUploaded: true, playCount: 156000 },
];

/* ---------- 购物车初始 ---------- */
export const initialCart: CartItem[] = [
  { workId: 101, qty: 1, color: '奶油白', size: 'M', checked: true },
  { workId: 105, qty: 1, color: '卡其', size: 'L', checked: true },
];

/* ---------- 订单 ---------- */
export const orders: Order[] = [
  {
    id: 3001, orderNo: 'ZM2026090110001', status: 2, amount: 587, createdAt: '2026-08-28 10:23',
    items: [
      { workId: 101, title: '法式碎花泡泡袖连衣裙', cover: img('dress-01.jpg'), color: '奶油白', size: 'M', qty: 1, price: 328 },
      { workId: 105, title: '通勤利落 · 高腰阔腿裤', cover: img('pants-02.jpg'), color: '卡其', size: 'L', qty: 1, price: 259 },
    ],
    address: { name: '陈小姐', phone: '138****5621', region: '浙江省 杭州市 西湖区', detail: '文三路 100 号 织梦公寓 2 幢 502' },
    progress: { stage: '缝制中', percent: 46, eta: '预计 09-05 完成' },
    isCustom: true,
  },
  {
    id: 3002, orderNo: 'ZM2026082500003', status: 5, amount: 399, createdAt: '2026-08-25 16:40',
    items: [{ workId: 108, title: '晨光缎面 · 真丝半裙', cover: img('skirt-02.jpg'), color: '香槟金', size: 'S', qty: 1, price: 399 }],
    address: { name: '陈小姐', phone: '138****5621', region: '浙江省 杭州市 西湖区', detail: '文三路 100 号 织梦公寓 2 幢 502' },
    progress: { stage: '已发货', percent: 100, eta: '已交付物流' },
    qc: { fabric: '面料成分符合：100%桑蚕丝 ✓', craft: '车缝线距均匀，无跳线 ✓', sizeDeviation: '尺寸偏差 0.8mm（标准 ≤5mm）✓', images: [img('skirt-02.jpg'), img('fabric-03.jpg')], pass: true },
    logistics: { company: '顺丰速运', trackingNo: 'SF1389261004521', traces: [
      { time: '08-30 08:12', text: '已揽收，快件从柔性工厂发出' },
      { time: '08-30 20:45', text: '到达杭州转运中心' },
      { time: '08-31 09:30', text: '派送中，快递员电话联系' },
    ] },
    isCustom: true,
  },
  {
    id: 3003, orderNo: 'ZM2026081800042', status: 6, amount: 199, createdAt: '2026-08-18 14:05',
    items: [{ workId: 112, title: '初夏微风 · 泡泡纱衬衫', cover: img('blouse-02.jpg'), color: '天空蓝', size: 'M', qty: 1, price: 199 }],
    address: { name: '陈小姐', phone: '138****5621', region: '浙江省 杭州市 西湖区', detail: '文三路 100 号 织梦公寓 2 幢 502' },
    isCustom: true,
  },
  {
    id: 3004, orderNo: 'ZM2026080200231', status: 7, amount: 149, createdAt: '2026-08-02 11:20',
    items: [{ workId: 104, title: '午后花园 · 泡泡袖方领上衣', cover: img('blouse-01.jpg'), color: '蜜桃粉', size: 'M', qty: 1, price: 149 }],
    address: { name: '陈小姐', phone: '138****5621', region: '浙江省 杭州市 西湖区', detail: '文三路 100 号 织梦公寓 2 幢 502' },
    isCustom: false,
  },
];

export const orderById = (id: number) => orders.find((o) => o.id === id);

/* ---------- 创作者后台 ---------- */
export const dashboard: DashboardData = {
  todayAmount: 12860,
  todayVisitors: 2431,
  conversionRate: 3.2,
  rank: 56,
  monthlyOrders: 486,
  totalOrders: 3128,
  works: [
    { id: 101, title: '法式碎花泡泡袖连衣裙', cover: img('dress-01.jpg'), conversionRate: 3.2, clickRate: 12.4, rank: 2, dailyOrders: 18, monthlyOrders: 386, returnRate: 4.2, todayAmount: 5904 },
    { id: 117, title: '微醺玫瑰 · 吊带连衣裙', cover: img('dress-18.jpg'), conversionRate: 2.8, clickRate: 9.7, rank: 21, dailyOrders: 11, monthlyOrders: 214, returnRate: 6.1, todayAmount: 3289 },
    { id: 115, title: '梨涡浅笑 · 蕾丝拼接连衣裙', cover: img('dress-15.jpg'), conversionRate: 2.1, clickRate: 7.9, rank: 87, dailyOrders: 6, monthlyOrders: 118, returnRate: 5.6, todayAmount: 1734 },
  ],
  trend7d: [
    { date: '08-26', orders: 8, amount: 2624 }, { date: '08-27', orders: 12, amount: 3936 },
    { date: '08-28', orders: 10, amount: 3280 }, { date: '08-29', orders: 15, amount: 4920 },
    { date: '08-30', orders: 13, amount: 4264 }, { date: '08-31', orders: 17, amount: 5576 },
    { date: '09-01', orders: 18, amount: 5904 },
  ],
  trend30d: Array.from({ length: 30 }, (_, i) => ({ date: `0${Math.floor(i / 10) + 1}-${String((i % 10) * 3 + 1).padStart(2, '0')}`, orders: 5 + Math.round(Math.sin(i / 3) * 4 + Math.random() * 4) })),
  returnTrend: [
    { date: '08-26', rate: 5.1 }, { date: '08-27', rate: 4.8 }, { date: '08-28', rate: 5.2 },
    { date: '08-29', rate: 4.6 }, { date: '08-30', rate: 4.4 }, { date: '08-31', rate: 4.1 },
    { date: '09-01', rate: 4.2 },
  ],
  channelShare: [
    { name: '广场推荐', value: 46, color: '#E85C87' },
    { name: '榜单', value: 28, color: '#C9A23F' },
    { name: '搜索', value: 16, color: '#3B82F6' },
    { name: '分享', value: 10, color: '#34A36F' },
  ],
  commission: { withdrawable: 12680.5, pending: 4380.2, total: 31820.8 },
  withdrawHistory: [
    { time: '08-25', amount: 5000, status: '已到账' },
    { time: '08-10', amount: 8000, status: '已到账' },
    { time: '07-28', amount: 4200, status: '已到账' },
  ],
};

/* ---------- 偏好标签 ---------- */
export const STYLE_TAGS = ['法式', '韩系', '简约', '复古', '街头', '甜美', '知性', '职业', '东方', '户外', '通勤', '晚宴', '度假', '学院'];
export const CATEGORIES = ['连衣裙', '衬衫', '半裙', '外套', '裤装', '套装', '配饰'];

/* ---------- 消息 ---------- */
export interface MessageItem { id: number; type: 'like' | 'collect' | 'comment' | 'system' | 'order'; title: string; desc: string; time: string; read: boolean; }
export const messages: MessageItem[] = [
  { id: 1, type: 'like', title: '莓莓酱 赞了你的作品', desc: '「法式碎花泡泡袖连衣裙」被点赞', time: '10分钟前', read: false },
  { id: 2, type: 'comment', title: 'Momo莫莫 评论了你', desc: '这件也太好看了吧😍', time: '30分钟前', read: false },
  { id: 3, type: 'order', title: '订单进度更新', desc: '订单 ZM2026090110001 已进入「缝制中」环节', time: '1小时前', read: false },
  { id: 4, type: 'collect', title: '山茶与猫 收藏了你的作品集', desc: '收藏了你的「法式浪漫」作品集', time: '2小时前', read: true },
  { id: 5, type: 'system', title: '系统通知', desc: '你的「设计师」认证已生效，解锁高级设计工具权限', time: '昨天', read: true },
  { id: 6, type: 'system', title: '佣金到账提醒', desc: '8月佣金 ¥4,380.20 已进入待结算', time: '昨天', read: true },
];

/* ---------- 3D背景 ---------- */
export const BG_SCENES = [
  { id: 'studio', name: '工作室', icon: 'layers', color: '#F3EDE8' },
  { id: 'street', name: '街拍', icon: 'sun', color: '#DCE6EE' },
  { id: 'cafe', name: '咖啡厅', icon: 'coffee', color: '#EADFD2' },
  { id: 'beach', name: '海滩', icon: 'beach', color: '#D8E8E4' },
  { id: 'night', name: '夜景', icon: 'moon', color: '#232A3D' },
  { id: 'custom', name: '自定义', icon: 'grid', color: '#E8E4EE' },
];
