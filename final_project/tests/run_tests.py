"""Test runner script to execute all tests with enhanced LLM validation."""
from io import StringIO
import unittest
import sys
import os

def run_all_tests():
    """Run all test modules."""
    # Discover and run all tests
    loader = unittest.TestLoader()
    start_dir = os.path.dirname(__file__)
    
    # Discover all test files
    suite = loader.discover(start_dir, pattern='test_*.py')
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Return success/failure
    return result.wasSuccessful()

def run_specific_tests(test_modules):
    """Run specific test modules."""
    suite = unittest.TestSuite()
    
    for module_name in test_modules:
        try:
            module = __import__(module_name)
            suite.addTest(unittest.defaultTestLoader.loadTestsFromModule(module))
        except ImportError as e:
            print(f"Could not import {module_name}: {e}")
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()

def run_llm_integration_tests():
    """Run LLM-specific integration tests."""
    print("\n🤖 Running LLM Integration Tests")
    print("=" * 40)
    
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        print("⚠️  No OpenAI API key found - LLM tests will check error handling")
    else:
        print(f"✅ API key found: {api_key[:10]}...")
        if not api_key.startswith("sk-"):
            print("⚠️  API key format looks incorrect")
    
    # Run LLM-specific tests
    suite = unittest.TestLoader().loadTestsFromName("test_llm_integration")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def print_environment_info():
    """Print test environment information."""
    print("\n🔧 Test Environment:")
    print(f"   Python: {sys.version.split()[0]}")
    print(f"   OpenAI API Key: {'✅ Set' if os.getenv('OPENAI_API_KEY') else '❌ Not set'}")
    print(f"   Debug LLM: {'✅ Enabled' if os.getenv('DEBUG_LLM_RESPONSES', '').lower() in ('true', '1', 'yes') else '❌ Disabled'}")
    print(f"   Model: {os.getenv('OPENAI_MODEL', 'Not set')}")
    print(f"   Max Tokens: {os.getenv('OPENAI_MAX_TOKENS', 'Not set')}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run game tests")
    parser.add_argument(
        "--module", "-m",
        action="append",
        help="Specific test module to run (can be used multiple times)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--llm-only",
        action="store_true",
        help="Run only LLM integration tests"
    )
    
    args = parser.parse_args()

    # Set testing environment
    os.environ.setdefault("TESTING", "true")
    
    print("🎮 Running Multi-Agent Strategy Game Tests")
    print("=" * 50)
    
    if args.llm_only:
        try:
            success = run_llm_integration_tests()
        except Exception as e:
            print(f"Error running LLM tests: {e}")
            success = False
    elif args.module:
        success = run_specific_tests(args.module)
    else:
        success = run_all_tests()
        
        # Also run LLM integration tests if available
        try:
            llm_success = run_llm_integration_tests()
            success = success and llm_success
        except Exception as e:
            print(f"⚠️  Could not run LLM integration tests: {e}")
    
    print_environment_info()
    
    if success:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)