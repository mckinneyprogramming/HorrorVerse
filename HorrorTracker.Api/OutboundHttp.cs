namespace HorrorTracker.Api.Catalog;

internal static class OutboundHttp
{
    internal static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? Send { get; set; }

    internal static HttpMessageHandler CreateHandler() => new HookHandler();

    private sealed class HookHandler : DelegatingHandler
    {
        public HookHandler()
            : base(new HttpClientHandler())
        {
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var transport = OutboundHttp.Send;
            if (transport is not null)
            {
                return transport(request, cancellationToken);
            }

            return base.SendAsync(request, cancellationToken);
        }
    }
}
