import os
import sys


def get_base_path():
    """Get the base path for the application"""
    if hasattr(sys, "_MEIPASS"):
        # When compiled, _MEIPASS points to the temporary extraction folder
        # where all bundled files are located
        return sys._MEIPASS  # pyright: ignore[reportAttributeAccessIssue]
    else:
        # In development, use the backend directory
        return os.path.abspath(os.path.dirname(__file__))
