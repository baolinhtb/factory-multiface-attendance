"""
Language management routes.
"""
import os
import glob
import shutil
import xml.etree.ElementTree as ET
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from api import auth

router = APIRouter()


@router.get("/")
async def get_languages():
    """List available languages."""
    lang_dir = "languages"
    if not os.path.exists(lang_dir):
        return []
    
    files = glob.glob(os.path.join(lang_dir, "*.xml"))
    languages = []
    for f in files:
        code = os.path.splitext(os.path.basename(f))[0]
        try:
            tree = ET.parse(f)
            root = tree.getroot()
            languages.append({"code": code, "name": code.upper()})
        except:
            pass
            
    return languages


@router.get("/{code}")
async def get_language_content(code: str):
    """Get language content."""
    file_path = os.path.join("languages", f"{code}.xml")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Language file not found")
        
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        resources = {}
        for child in root:
            if child.tag == 'string':
                name = child.attrib.get('name')
                if name:
                    resources[name] = child.text
        return resources
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing language file: {str(e)}")


@router.post("/upload")
async def upload_language(
    file: UploadFile = File(...),
    admin: dict = Depends(auth.get_admin_user)
):
    """Upload language file."""
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="Only XML files are allowed")
        
    lang_dir = "languages"
    if not os.path.exists(lang_dir):
        os.makedirs(lang_dir)
        
    file_path = os.path.join(lang_dir, file.filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Verify it's valid XML
    try:
        ET.parse(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Invalid XML file: {str(e)}")
        
    return {"message": "Language uploaded successfully", "filename": file.filename}
