using HorrorTracker.Api.Library;

namespace HorrorTracker.Api.Social;

public sealed record PersonCardDto(
    int Id,
    string DisplayName,
    string? AboutMe,
    string? Avatar,
    int FriendCount,
    int FollowerCount,
    int FollowingCount,
    string Relation,
    bool Following,
    bool FollowedBy,
    IReadOnlyList<UserListDto>? Lists = null,
    IReadOnlyList<string>? FinishedIds = null);

public sealed record FriendInboxDto(
    IReadOnlyList<PersonCardDto> Friends,
    IReadOnlyList<PersonCardDto> Incoming,
    IReadOnlyList<PersonCardDto> Outgoing,
    IReadOnlyList<PersonCardDto> Following);

public sealed class SocialWriteRequest
{
    public int? UserId { get; set; }
    public string? Action { get; set; }
}
