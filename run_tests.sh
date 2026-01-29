#!/bin/bash

# FINREPO Test Suite Runner
# Usage: ./run_tests.sh [option]
#
# Options:
#   all              Run all tests
#   unit             Run unit tests only
#   regression       Run regression tests only
#   integration      Run integration tests (database required)
#   quick            Run fast unit tests only
#   coverage         Run all tests with coverage report
#   help             Show this help message

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}FINREPO Test Suite${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo -e "${RED}pytest not installed. Installing test requirements...${NC}"
    pip install -q -r test/requirements.txt
fi

# Test option
TEST_OPTION="${1:-all}"

case $TEST_OPTION in
    all)
        echo -e "${YELLOW}Running ALL tests...${NC}\n"
        cd "$PROJECT_ROOT"
        pytest test/ -v --tb=short
        ;;
    unit)
        echo -e "${YELLOW}Running UNIT tests...${NC}\n"
        cd "$PROJECT_ROOT"
        pytest test/unit/ -v --tb=short -m "not slow"
        ;;
    regression)
        echo -e "${YELLOW}Running REGRESSION tests...${NC}\n"
        echo -e "${YELLOW}Note: Database must be running${NC}\n"
        cd "$PROJECT_ROOT"
        pytest test/regression/ -v --tb=short
        ;;
    integration)
        echo -e "${YELLOW}Running INTEGRATION tests...${NC}\n"
        echo -e "${YELLOW}Note: Database must be running${NC}\n"
        cd "$PROJECT_ROOT"
        pytest test/ -v --tb=short -m "db"
        ;;
    quick)
        echo -e "${YELLOW}Running QUICK unit tests (no database)...${NC}\n"
        cd "$PROJECT_ROOT"
        pytest test/unit/ -v --tb=short
        ;;
    coverage)
        echo -e "${YELLOW}Running tests with COVERAGE report...${NC}\n"
        cd "$PROJECT_ROOT"
        pytest test/ -v --cov=src --cov-report=html --cov-report=term
        echo -e "${GREEN}Coverage report generated in htmlcov/index.html${NC}"
        ;;
    help)
        echo "FINREPO Test Suite"
        echo ""
        echo "Usage: ./run_tests.sh [option]"
        echo ""
        echo "Options:"
        echo "  all         Run all tests (unit + regression + integration)"
        echo "  unit        Run unit tests only"
        echo "  regression  Run regression tests (requires database)"
        echo "  integration Run integration tests (requires database)"
        echo "  quick       Run fast unit tests only"
        echo "  coverage    Run all tests with coverage report"
        echo "  help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./run_tests.sh                # Run all tests"
        echo "  ./run_tests.sh unit           # Run unit tests"
        echo "  ./run_tests.sh coverage       # Generate coverage report"
        ;;
    *)
        echo -e "${RED}Unknown option: $TEST_OPTION${NC}"
        echo "Run './run_tests.sh help' for usage information"
        exit 1
        ;;
esac

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Test run completed${NC}"
echo -e "${GREEN}================================${NC}"
