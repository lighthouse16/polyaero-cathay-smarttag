from app.services.risk_engine import (
    ARTIFACT_PATH,
    FlightRiskFeatures,
    TrainedHubFeederRiskModel,
)


def test_packaged_model_loads_and_predicts():
    model = TrainedHubFeederRiskModel(ARTIFACT_PATH)
    assessment = model.predict(
        FlightRiskFeatures(flight_number="CX548", origin="HKG", destination="NRT")
    )
    assert assessment.model_version == model.model_version
    assert 0 <= assessment.risk_score <= 100
