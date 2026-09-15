package dreamweaver.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** 全局异常 → 统一 JSON。 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse> handleApi(ApiException e) {
        return ResponseEntity.status(e.status()).body(ApiResponse.fail(e.code(), e.getMessage()));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse> handleNotFound(NoResourceFoundException e) {
        return ResponseEntity.status(404)
                .body(ApiResponse.fail("NOT_FOUND", "接口不存在（请对照 ITER_V2_SPEC §4）"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse> handleOther(Exception e) {
        log.error("[core] 未捕获异常", e);
        String msg = e.getMessage() == null ? "未知错误" : e.getMessage();
        return ResponseEntity.status(500).body(ApiResponse.fail("INTERNAL", "服务异常：" + msg));
    }
}
