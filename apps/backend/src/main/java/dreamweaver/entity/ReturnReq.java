package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 售后请求。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReturnReq {
    /** none | returning | done | exchanged */
    public String state = "none";
    public double refundAmount;
    public double baseFeeKept;
    public String reason = "";
    public String at;
    public Integer resaleListingId;
    public Integer newOrderId;
}
