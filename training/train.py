import torch
import torch.nn as nn
import torch.optim as optim

# Our neural network
class MyAI(nn.Module):
    def __init__(self):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(1, 16),
            nn.ReLU(),
            nn.Linear(16, 16),
            nn.ReLU(),
            nn.Linear(16, 1)
        )

    def forward(self, x):
        return self.network(x)


# Create the AI
model = MyAI()

# Training data
# We are teaching the AI: y = 2x
x = torch.tensor([
    [1.0],
    [2.0],
    [3.0],
    [4.0],
    [5.0],
    [6.0],
    [7.0],
    [8.0],
    [9.0],
    [10.0]
])

y = torch.tensor([
    [2.0],
    [4.0],
    [6.0],
    [8.0],
    [10.0],
    [12.0],
    [14.0],
    [16.0],
    [18.0],
    [20.0]
])

# How the AI learns
loss_function = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.01)

# Train
for epoch in range(2000):

    prediction = model(x)

    loss = loss_function(prediction, y)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    if epoch % 200 == 0:
        print(f"Epoch {epoch} | Loss: {loss.item():.6f}")


# Test the AI
test = torch.tensor([[20.0]])

result = model(test)

print()
print("🤖 AI prediction:")
print("Input: 20")
print("AI predicted:", result.item())
print("Correct answer: 40")