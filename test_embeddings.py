from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim

model = SentenceTransformer("BAAI/bge-m3")

user_problem = "My AC is running but not cooling"

service_descriptions = [
    "Air conditioner cooling repair",
    "Refrigerator repair",
    "Plumbing and water leak repair",
    "Electrical fan repair",
]

user_vector = model.encode(
    user_problem,
    convert_to_tensor=True
)

service_vectors = model.encode(
    service_descriptions,
    convert_to_tensor=True
)

scores = cos_sim(user_vector, service_vectors)[0]

for description, score in sorted(
    zip(service_descriptions, scores.tolist()),
    key=lambda item: item[1],
    reverse=True
):
    print(f"{description}: {score:.4f}")
