declare namespace PortOne {
  interface IssueBillingKeyRequest {
    storeId: string;
    channelKey: string;
    billingKeyMethod: "EASY_PAY" | "CARD";
    issueName: string;
    customer?: {
      customerId?: string;
      email?: string;
      fullName?: string;
      phoneNumber?: string;
    };
  }

  interface IssueBillingKeyResponse {
    code?: string;
    message?: string;
    billingKey?: string;
  }

  function requestIssueBillingKey(
    request: IssueBillingKeyRequest
  ): Promise<IssueBillingKeyResponse>;
}

interface Window {
  PortOne: typeof PortOne;
}
