import faiss
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional

class FaceRecognizer:
    def __init__(self, dimension: int = 512):
        """
        Initialize the FaceRecognizer with FAISS.
        
        Args:
            dimension (int): Dimension of the face embeddings (default 512 for InsightFace buffalo_l).
        """
        self.logger = logging.getLogger(__name__)
        self.dimension = dimension
        self.index = None
        self.employees = [] # Maps index ID to employee data
        
        # Initialize FAISS index
        # We use IndexFlatIP (Inner Product) which is equivalent to Cosine Similarity
        # IF the vectors are normalized (which InsightFace embeddings usually are).
        try:
            self.index = faiss.IndexFlatIP(self.dimension)
            print("FAISS index initialized successfully (Inner Product).")
        except Exception as e:
            print(f"Failed to initialize FAISS index: {e}")
            self.index = None

    def load_faces(self, employees_data: List[Dict]):
        """
        Load faces into the FAISS index.
        
        Args:
            employees_data (list): List of dicts, each containing 'embedding' and other metadata.
        """
        if self.index is None:
            print("FAISS index is not initialized.")
            return

        # Reset index
        self.index.reset()
        self.employees = []
        
        embeddings_list = []
        
        try:
            for emp in employees_data:
                emb = emp.get('embedding')
                if emb is not None:
                    # Ensure embedding is numpy array of float32
                    if isinstance(emb, list):
                        emb = np.array(emb, dtype=np.float32)
                    elif isinstance(emb, np.ndarray):
                        emb = emb.astype(np.float32)
                        
                    # Normalize if not already (vital for IP to act as Cosine Sim)
                    faiss.normalize_L2(emb.reshape(1, -1))
                    
                    embeddings_list.append(emb)
                    # Store metadata mapped by current index
                    self.employees.append({
                        'id': emp.get('id'),
                        'name': emp.get('name'),
                        'employee_id': emp.get('employee_id') # Original ID string
                    })
            
            if embeddings_list:
                # Stack and add to index
                embeddings_matrix = np.vstack(embeddings_list)
                self.index.add(embeddings_matrix)
                print(f"Loaded {self.index.ntotal} faces into FAISS index.")
            else:
                print("No valid embeddings found to load.")
                
        except Exception as e:
            print(f"Error loading faces into FAISS: {e}")

    def identify(self, embedding: np.ndarray, threshold: float = 0.45) -> Tuple[Optional[str], str, float]:
        """
        Identify a face using FAISS search.
        
        Args:
            embedding (np.ndarray): The face embedding to search.
            threshold (float): Similarity threshold (0.0 to 1.0).
            
        Returns:
            tuple: (employee_database_id, employee_name, score)
                   Returns (None, "Chưa nhận diện", score) if not found.
        """
        if self.index is None or self.index.ntotal == 0:
            return None, "Chưa nhận diện", 0.0
            
        try:
            # Prepare query vector
            q_emb = embedding.astype(np.float32).reshape(1, -1)
            faiss.normalize_L2(q_emb)
            
            # Search for the 1 nearest neighbor
            k = 1
            D, I = self.index.search(q_emb, k)
            
            score = D[0][0]
            index_id = I[0][0]
            
            if score > threshold and index_id != -1:
                # Match found
                emp_data = self.employees[index_id]
                return emp_data['id'], emp_data['name'], float(score)
            else:
                # No match above threshold
                return None, "Chưa nhận diện", float(score)
                
        except Exception as e:
            print(f"Error during FAISS identification: {e}")
            return None, "Chưa nhận diện", 0.0
