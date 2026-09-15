package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.PostService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** feed / posts 路由：广场、发推文、互动（点赞/评论/分享触发资源池增量评估）（对应 apps/server/src/routes/feed.ts）。 */
@RestController
@RequestMapping("/api")
public class FeedController {

    private final PostService posts;

    public FeedController(PostService posts) {
        this.posts = posts;
    }

    /* ------------------------------- 路由 ------------------------------- */

    @PostMapping("/posts")
    public ApiResponse createPost(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(posts.createPost(RequestContext.requireUserId(), body));
    }

    @GetMapping("/feed")
    public ApiResponse feed(@RequestParam(required = false) String tab,
                            @RequestParam(required = false) String page,
                            @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(posts.feed(RequestContext.currentUserId(), tab, page, pageSize));
    }

    /** 我的推文（作者本人，按近 1/3/7 天筛选；每条附带 market 市场认可进度） */
    @GetMapping("/posts/mine")
    public ApiResponse myPosts(@RequestParam(required = false) String days,
                               @RequestParam(required = false) String page,
                               @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(posts.myPosts(RequestContext.requireUserId(), days, page, pageSize));
    }

    @GetMapping("/posts/{id}")
    public ApiResponse postDetail(@PathVariable("id") long id) {
        return ApiResponse.ok(posts.postDetail(RequestContext.currentUserId(), (int) id));
    }

    @PostMapping("/posts/{id}/like")
    public ApiResponse like(@PathVariable("id") long id) {
        return ApiResponse.ok(posts.like(RequestContext.requireUserId(), (int) id));
    }

    @PostMapping("/posts/{id}/unlike")
    public ApiResponse unlike(@PathVariable("id") long id) {
        return ApiResponse.ok(posts.unlike(RequestContext.requireUserId(), (int) id));
    }

    @PostMapping("/posts/{id}/comment")
    public ApiResponse comment(@PathVariable("id") long id, @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(posts.comment(RequestContext.requireUserId(), (int) id, body));
    }

    @PostMapping("/posts/{id}/share")
    public ApiResponse share(@PathVariable("id") long id) {
        RequestContext.requireUserId();
        return ApiResponse.ok(posts.share((int) id));
    }

    /** 消费者首页补充：达人/官方精选（可选） */
    @GetMapping("/feed/recommend/seed")
    public ApiResponse recommendSeed() {
        return ApiResponse.ok(posts.recommendSeed());
    }
}
