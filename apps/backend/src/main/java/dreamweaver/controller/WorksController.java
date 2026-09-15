package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.WorkService;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** works 路由：作品组织（素材组装）（对应 apps/server/src/routes/works.ts）。 */
@RestController
@RequestMapping("/api")
public class WorksController {

    private final WorkService works;

    public WorksController(WorkService works) {
        this.works = works;
    }

    /* ------------------------------- 路由 ------------------------------- */

    @PostMapping("/works")
    public ApiResponse create(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(works.create(RequestContext.requireUserId(), body));
    }

    @GetMapping("/works/mine")
    public ApiResponse mine() {
        return ApiResponse.ok(works.mine(RequestContext.currentUserId()));
    }

    /** 编辑作品（作品管理 → 编辑） */
    @PatchMapping("/works/{id}")
    public ApiResponse edit(@PathVariable("id") long id, @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(works.edit(RequestContext.currentUserId(), (int) id, body));
    }

    /** 删除作品（作品管理 → 删除）：已被橱窗材料/商品/资源池引用的作品不允许删除 */
    @DeleteMapping("/works/{id}")
    public ApiResponse remove(@PathVariable("id") long id) {
        return ApiResponse.ok(works.remove(RequestContext.currentUserId(), (int) id));
    }

    @GetMapping("/works/{id}")
    public ApiResponse detail(@PathVariable("id") long id) {
        return ApiResponse.ok(works.detail((int) id));
    }
}
