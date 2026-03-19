from fastapi import APIRouter, Query
from livekit.api import AccessToken, VideoGrants
from app.config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL

router = APIRouter(tags=["token"])


@router.get("/token")
async def get_token(
    room: str = Query(..., description="Room name"),
    identity: str = Query(default="user", description="Participant identity"),
):
    token = (
        AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(VideoGrants(room_join=True, room=room))
    )
    jwt = token.to_jwt()
    return {"token": jwt, "url": LIVEKIT_URL}
