package dreamweaver.service;

import java.util.Map;

/** 推文（信息流）业务：发推文、广场三种 tab、互动、我的推文（对应 apps/server/src/routes/feed.ts）。 */
public interface PostService {

    /** 发推文（仅创作者；标签解析/素材归属校验/images 自动补封面），返回 detail 版 postDTO + materialPreview + author。 */
    Map<String, Object> createPost(int userId, Map<String, Object> body);

    /** 信息流：tab=rec/follow/hot 的排序 + 分页 + poolMeta。 */
    Map<String, Object> feed(Integer viewerId, String tab, String page, String pageSize);

    /** 我的推文（作者本人，按近 1/3/7 天筛选；每条附带 market 市场认可进度）。 */
    Map<String, Object> myPosts(int userId, String days, String page, String pageSize);

    /** 推文详情（detail 版 postDTO）。 */
    Map<String, Object> postDetail(Integer viewerId, int postId);

    /** 点赞（幂等 toggle），返回 {likes,liked}。 */
    Map<String, Object> like(int userId, int postId);

    /** 取消赞（幂等 toggle），返回 {likes,liked}。 */
    Map<String, Object> unlike(int userId, int postId);

    /** 评论，返回 {comment,commentCount}。 */
    Map<String, Object> comment(int userId, int postId, Map<String, Object> body);

    /** 分享，返回 {shareCount}。 */
    Map<String, Object> share(int postId);

    /** 消费者首页补充：达人 + 官方精选（来自资源池的作品）。 */
    Map<String, Object> recommendSeed();
}
