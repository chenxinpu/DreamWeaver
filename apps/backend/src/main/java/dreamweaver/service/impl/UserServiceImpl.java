package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.Work;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.UserService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 用户公开资料 + 创作者聚合（对应 apps/server/src/routes/users.ts）。 */
@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final WorkRepository workRepository;
    private final ProductRepository productRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final PostRepository postRepository;
    private final DtoMapper dto;

    public UserServiceImpl(UserRepository userRepository,
                           WorkRepository workRepository,
                           ProductRepository productRepository,
                           PoolEntryRepository poolEntryRepository,
                           PostRepository postRepository,
                           DtoMapper dto) {
        this.userRepository = userRepository;
        this.workRepository = workRepository;
        this.productRepository = productRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.postRepository = postRepository;
        this.dto = dto;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> detail(int userId) {
        User user = userRepository.findById(userId).orElse(null);
        // 原实现用 bad('NOT_FOUND','用户不存在') → 400（不是 404），此处保持一致
        if (user == null) throw Errors.bad("NOT_FOUND", "用户不存在");

        List<Work> mine = workRepository.findByCreatorIdOrderByIdAsc(userId);
        // slice(-12) 后 reverse()：最近 12 个作品，新的在前
        List<Work> last12 = mine.size() <= 12
                ? new ArrayList<>(mine)
                : new ArrayList<>(mine.subList(mine.size() - 12, mine.size()));
        Collections.reverse(last12);

        List<Map<String, Object>> works = new ArrayList<>();
        for (Work w : last12) {
            Map<String, Object> brief = dto.workBrief(w);
            brief.put("createdAt", w.createdAt);
            works.add(brief);
        }

        Map<String, Object> agg = new LinkedHashMap<>();
        agg.put("user", dto.toUserPublic(user));
        agg.put("works", works);
        if (user.role == Role.CREATOR || user.role == Role.AUDITOR) {
            int productCount = (int) productRepository.countByCreatorIdAndStatus(userId, "onSale");
            int poolCount = (int) poolEntryRepository.countByCreatorId(userId);
            int postsCount = (int) postRepository.countByAuthorId(userId);
            Map<String, Object> creator = new LinkedHashMap<>();
            creator.put("productCount", productCount);
            creator.put("poolCount", poolCount);
            creator.put("postsCount", postsCount);
            agg.put("creator", creator);
        }
        return agg;
    }
}
