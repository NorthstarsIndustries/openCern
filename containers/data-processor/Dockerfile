FROM python:3.12-slim

# Set up non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install Python dependencies for data processor
RUN pip install --no-cache-dir uproot awkward numpy tqdm pandas pylhe pyhepmc pyarrow h5py

# Copy the script
COPY main.py .

# Change ownership
RUN chown -R appuser:appuser /app
USER appuser

# This container is run ephemerally with a ROOT file path as argument 
ENTRYPOINT ["python", "/app/main.py"]
