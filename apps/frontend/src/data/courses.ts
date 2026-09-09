/* ============================================================================
 * 学习中心（V1 保留页面）本地数据 —— 课程 mock 例外（SPEC §7 允许学习中心 mock）
 * V2 中学习中心不改造为 API，仅入口接入新壳；此文件为其提供自洽数据源。
 * ==========================================================================*/

export const img = (name: string) => `/images/${name}`;

export interface CourseOutline {
  title: string;
  duration: number; // 秒
  done?: boolean;
}

export interface Course {
  id: number;
  title: string;
  instructorId: number;
  category: string; // 设计基础/面料知识/打版技巧/软件操作/趋势分析/品牌运营
  level: 1 | 2 | 3;
  duration: number;
  learners: number;
  cover: string;
  desc: string;
  outline: CourseOutline[];
  isUserUploaded: boolean;
  playCount: number;
  certified?: boolean;
}

interface LearnUser {
  id: number;
  nickname: string;
  avatar: string;
  bio: string;
  level: number;
}

const LEARN_USERS: LearnUser[] = [
  { id: 1, nickname: '小织', avatar: img('avatar-01.jpg'), level: 3, bio: '独立设计师｜专注法式浪漫风' },
  { id: 2, nickname: '鹿屿Lu', avatar: img('avatar-02.jpg'), level: 3, bio: '主理人｜做有温度的衣服' },
  { id: 3, nickname: '云端裁缝铺', avatar: img('avatar-03.jpg'), level: 2, bio: '从打版师到设计师｜分享工艺细节' },
  { id: 4, nickname: '莓莓酱', avatar: img('avatar-04.jpg'), level: 1, bio: '设计学徒学习中～' },
  { id: 10, nickname: '针织日记', avatar: img('avatar-10.jpg'), level: 2, bio: '手织毛衫的温度' },
  { id: 12, nickname: '丝语Silk', avatar: img('avatar-12.jpg'), level: 2, bio: '真丝面料研究员' },
  { id: 14, nickname: '我的小号', avatar: img('avatar-14.jpg'), level: 0, bio: '' },
];

/** 学习中心默认“我”（消费者小号；上传教程按 level 锁定） */
export const me = LEARN_USERS.find((u) => u.id === 14) || LEARN_USERS[0];

export const userById = (id: number) => LEARN_USERS.find((u) => u.id === id) || LEARN_USERS[0];

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
  { id: 207, title: '个人品牌运营指南', instructorId: 2, category: '品牌运营', level: 3, duration: 62 * 60, learners: 12000, cover: img('style-19.jpg'), desc: '从0到1孵化个人品牌：品牌定位、内容矩阵、粉丝运营、供应链对接与合作模式全流程。', outline: [
    { title: '品牌定位与命名', duration: 12 * 60 },
    { title: '内容与账号运营', duration: 15 * 60 },
    { title: '供应链合作模式', duration: 14 * 60 },
    { title: '商业化与私域', duration: 21 * 60 },
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
