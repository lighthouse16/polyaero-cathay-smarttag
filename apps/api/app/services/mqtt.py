import json
import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


async def publish_display(tag_id: UUID, payload: dict[str, Any]) -> bool:
    """Push the E-ink display payload to the IoT broker.

    shortcut: log-only until an MQTT client is added; add paho-mqtt and
    settings.mqtt_broker_url when the hardware bridge exists.
    """
    logger.info("MQTT display payload for tag %s: %s", tag_id, json.dumps(payload))
    return False
